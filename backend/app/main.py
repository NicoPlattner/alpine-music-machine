import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pythonosc.udp_client import SimpleUDPClient
from starlette.requests import ClientDisconnect


ENGINE_HOST = os.getenv("AUDIO_ENGINE_HOST", "audio-engine")
ENGINE_PORT = int(os.getenv("AUDIO_ENGINE_PORT", "57120"))
STEMS = tuple(s.strip() for s in os.getenv("STEMS", "backing,bass,drums,guitar,vocals").split(",") if s.strip())
DURATION = float(os.getenv("SONG_DURATION_SECONDS", "0"))
PREBUFFER_SECONDS = float(os.getenv("AUDIO_PREBUFFER_SECONDS", "3"))
LYRICS_PATH = Path(os.getenv("LYRICS_PATH", "/music/lyrics.word-timed.json"))

# Levels are gains (1.0 = unchanged), tone controls are dB, and the two effect
# amounts are normalized. Keep these server-side so every client and the audio
# engine share one authoritative definition of a genre.
GENRE_PRESETS = {
    "pop": {"label": "Pop", "volumes": {"backing": 0.95, "bass": 1.05, "drums": 1.10, "guitar": 0.90, "vocals": 1.20}, "effects": {"bass": 2.0, "treble": 2.5, "reverb": 0.12, "compression": 0.45}},
    "rock": {"label": "Rock", "volumes": {"backing": 0.75, "bass": 1.10, "drums": 1.20, "guitar": 1.25, "vocals": 1.05}, "effects": {"bass": 2.5, "treble": 3.0, "reverb": 0.16, "compression": 0.55}},
    "hip-hop": {"label": "Hip-Hop", "volumes": {"backing": 0.80, "bass": 1.35, "drums": 1.20, "guitar": 0.60, "vocals": 1.15}, "effects": {"bass": 6.0, "treble": 1.0, "reverb": 0.08, "compression": 0.65}},
    "electronic": {"label": "Electronic", "volumes": {"backing": 1.15, "bass": 1.25, "drums": 1.25, "guitar": 0.65, "vocals": 0.95}, "effects": {"bass": 4.5, "treble": 4.0, "reverb": 0.22, "compression": 0.70}},
    "jazz": {"label": "Jazz", "volumes": {"backing": 0.95, "bass": 1.15, "drums": 0.85, "guitar": 1.10, "vocals": 1.00}, "effects": {"bass": 1.5, "treble": -1.0, "reverb": 0.24, "compression": 0.20}},
    "classical": {"label": "Classical", "volumes": {"backing": 1.20, "bass": 0.90, "drums": 0.65, "guitar": 1.00, "vocals": 0.95}, "effects": {"bass": 0.0, "treble": 1.5, "reverb": 0.38, "compression": 0.08}},
    "reggae": {"label": "Reggae", "volumes": {"backing": 0.90, "bass": 1.30, "drums": 1.05, "guitar": 1.15, "vocals": 1.00}, "effects": {"bass": 5.0, "treble": -1.5, "reverb": 0.28, "compression": 0.35}},
    "metal": {"label": "Metal", "volumes": {"backing": 0.65, "bass": 1.10, "drums": 1.30, "guitar": 1.35, "vocals": 1.05}, "effects": {"bass": 3.5, "treble": 4.5, "reverb": 0.10, "compression": 0.80}},
}


@dataclass
class MixerState:
    playing: bool = False
    speed: float = 1.0
    position: float = 0.0
    changed_at: float = field(default_factory=time.monotonic)
    volumes: dict[str, float] = field(default_factory=lambda: {stem: 1.0 for stem in STEMS})
    genre: Optional[str] = None
    effects: dict[str, float] = field(default_factory=lambda: {
        "bass": 0.0, "treble": 0.0, "reverb": 0.0, "compression": 0.0
    })

    def current_position(self) -> float:
        if not self.playing:
            return self.position
        value = self.position + (time.monotonic() - self.changed_at) * self.speed
        return min(value, DURATION) if DURATION else value

    def snapshot_transport(self) -> None:
        self.position = self.current_position()
        self.changed_at = time.monotonic()


class LiveAudioRelay:
    def __init__(self) -> None:
        self.listeners: set[asyncio.Queue[bytes]] = set()
        self.encoder_connected = False
        self._lock = asyncio.Lock()

    async def publish(self, chunk: bytes) -> None:
        async with self._lock:
            listeners = tuple(self.listeners)
        for queue in listeners:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            queue.put_nowait(chunk)

    async def subscribe(self, prebuffer_seconds: float):
        # Collect a short safety window before sending the first byte. The HTTP
        # client then receives a burst and can survive scheduler/network jitter
        # while the live encoder continues filling the tail of the stream.
        queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=512)
        async with self._lock:
            self.listeners.add(queue)
        try:
            buffered: list[bytes] = []
            deadline = time.monotonic() + prebuffer_seconds
            while time.monotonic() < deadline:
                timeout = deadline - time.monotonic()
                try:
                    buffered.append(await asyncio.wait_for(queue.get(), timeout))
                except TimeoutError:
                    break
            if buffered:
                yield b"".join(buffered)
            while True:
                yield await queue.get()
        finally:
            async with self._lock:
                self.listeners.discard(queue)


state = MixerState()
relay = LiveAudioRelay()


def send_osc(address: str, value=None) -> None:
    """Resolve the engine lazily because Compose starts it after this API is healthy."""
    try:
        client = SimpleUDPClient(ENGINE_HOST, ENGINE_PORT)
        client.send_message(address, [] if value is None else value)
    except OSError:
        # UDP has no delivery acknowledgement. The engine starts with the same
        # defaults, and a later user request will resolve and send normally.
        pass


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(title="Live Stem Mixer", version="0.1.0", lifespan=lifespan)


class SpeedChange(BaseModel):
    speed: float = Field(ge=0.5, le=1.5)


class SeekChange(BaseModel):
    position: float = Field(ge=0)


class VolumeChange(BaseModel):
    volume: float = Field(ge=0, le=1.5)


def response_state() -> dict:
    if state.playing and DURATION and state.current_position() >= DURATION:
        state.position = DURATION
        state.playing = False
        state.changed_at = time.monotonic()
        send_osc("/transport/pause")
    result = asdict(state)
    result["position"] = state.current_position()
    result.pop("changed_at")
    result["duration"] = DURATION
    result["audio_connected"] = relay.encoder_connected
    return result


def word_timed_lyrics() -> dict:
    """Load the timing data from the mounted song directory on each request."""
    try:
        payload = json.loads(LYRICS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise HTTPException(404, "Word-timed lyrics are not available for this song") from error
    except json.JSONDecodeError as error:
        raise HTTPException(500, "Word-timed lyrics are invalid JSON") from error

    if not isinstance(payload, dict) or not isinstance(payload.get("words"), list):
        raise HTTPException(500, "Word-timed lyrics must contain a words array")
    return payload


@app.get("/health")
async def health():
    return {"status": "ok", "audio_connected": relay.encoder_connected}


@app.get("/api/state")
async def get_state():
    return response_state()


@app.get("/api/genres")
async def get_genres():
    return [{"id": genre, "label": preset["label"]} for genre, preset in GENRE_PRESETS.items()]


@app.get("/api/lyrics/word-timed")
async def get_word_timed_lyrics():
    return word_timed_lyrics()


@app.put("/api/genres/{genre}")
async def apply_genre(genre: str):
    preset = GENRE_PRESETS.get(genre.lower())
    if preset is None:
        raise HTTPException(404, f"Unknown genre: {genre}")
    state.genre = genre.lower()
    state.effects = dict(preset["effects"])
    for stem in state.volumes:
        volume = preset["volumes"].get(stem, 1.0)
        state.volumes[stem] = volume
        send_osc("/mixer/volume", [stem, volume])
    send_osc("/mixer/effects", [state.effects["bass"], state.effects["treble"], state.effects["reverb"], state.effects["compression"]])
    return response_state()


@app.post("/api/transport/play")
async def play():
    response_state()
    if DURATION and state.position >= DURATION:
        state.position = 0.0
        send_osc("/transport/seek", 0.0)
    if not state.playing:
        state.changed_at = time.monotonic()
        state.playing = True
        send_osc("/transport/play")
    return response_state()


@app.post("/api/transport/restart")
async def restart():
    state.position = 0.0
    state.changed_at = time.monotonic()
    state.playing = True
    send_osc("/transport/seek", 0.0)
    send_osc("/transport/play")
    return response_state()


@app.post("/api/transport/pause")
async def pause():
    if state.playing:
        state.snapshot_transport()
        state.playing = False
        send_osc("/transport/pause")
    return response_state()


@app.put("/api/transport/speed")
async def set_speed(change: SpeedChange):
    state.snapshot_transport()
    state.speed = change.speed
    send_osc("/transport/speed", change.speed)
    return response_state()


@app.put("/api/transport/seek")
async def seek(change: SeekChange):
    if DURATION and change.position > DURATION:
        raise HTTPException(422, f"position must not exceed {DURATION:.3f} seconds")
    state.position = change.position
    state.changed_at = time.monotonic()
    send_osc("/transport/seek", change.position)
    return response_state()


@app.put("/api/stems/{stem}/volume")
async def set_volume(stem: str, change: VolumeChange):
    if stem not in state.volumes:
        raise HTTPException(404, f"Unknown stem: {stem}")
    state.volumes[stem] = change.volume
    state.genre = None
    send_osc("/mixer/volume", [stem, change.volume])
    return response_state()


@app.put("/internal/audio", include_in_schema=False)
async def ingest_audio(request: Request):
    relay.encoder_connected = True
    try:
        try:
            async for chunk in request.stream():
                if chunk:
                    await relay.publish(chunk)
        except ClientDisconnect:
            pass
    finally:
        relay.encoder_connected = False
    return {"status": "stream ended"}


@app.get("/api/audio/live.mp3")
async def live_audio(prebuffer: float = PREBUFFER_SECONDS):
    prebuffer = min(max(prebuffer, 0.2), 10.0)
    return StreamingResponse(
        relay.subscribe(prebuffer),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
