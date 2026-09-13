from __future__ import annotations

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pythonosc.udp_client import SimpleUDPClient
from starlette.requests import ClientDisconnect

ENGINE_HOST = os.getenv("AUDIO_ENGINE_HOST", "audio-engine")
ENGINE_PORT = int(os.getenv("AUDIO_ENGINE_PORT", "57120"))
DURATION = float(os.getenv("SONG_DURATION_SECONDS", "209.797149"))
SONG_BPM = float(os.getenv("SONG_BPM", "114"))
PREBUFFER_SECONDS = float(os.getenv("AUDIO_PREBUFFER_SECONDS", "3"))
LYRICS_PATH = Path(os.getenv("LYRICS_PATH", "/music/lyrics.word-timed.json"))
CORS_ORIGINS = tuple(
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
)

TRACKS = (
    ("track-1", "E. Piano 2"), ("track-2", "Synth Bass 2"), ("track-3", "Clean Guitar"),
    ("track-4", "Melody"), ("track-5", "Piccolo"), ("track-6", "Synth Drum A"),
    ("track-7", "Synth Drum B"), ("track-8", "Saw Wave"), ("track-9", "Soprano Sax"),
    ("track-10", "Drums"), ("track-11", "Strings"), ("track-12", "Trumpet"),
    ("track-13", "Brass 1"), ("track-14", "Whistle"), ("track-15", "Muted Guitar"),
)
TRACK_NAMES = dict(TRACKS)
# General MIDI program numbers are zero-based. These are read directly from the
# source file and are the authoritative, unmodified Pop instrumentation.
SOURCE_PROGRAMS = [5, 39, 27, 73, 72, 118, 118, 81, 64, 0, 48, 56, 61, 78, 28]
GM_NAMES = {
    0: "Acoustic grand piano", 5: "Electric piano 2", 16: "Drawbar organ",
    25: "Steel-string guitar", 27: "Clean electric guitar", 28: "Muted guitar",
    29: "Overdriven guitar", 30: "Distorted guitar", 32: "Acoustic bass",
    34: "Picked electric bass", 38: "Synth bass 1", 39: "Synth bass 2",
    40: "Violin", 42: "Cello", 46: "Orchestral harp", 48: "String ensemble",
    56: "Trumpet", 60: "French horn", 61: "Brass section", 64: "Soprano sax",
    65: "Alto sax", 71: "Clarinet", 72: "Piccolo", 73: "Flute",
    78: "Whistle", 81: "Saw wave", 88: "Fantasia pad", 89: "Warm pad",
    118: "Synth drum",
}
DRUM_KIT_NAMES = {0: "Standard kit", 8: "Room kit", 16: "Power kit",
                  24: "Electronic kit", 25: "TR-808 kit", 32: "Jazz kit",
                  40: "Brush kit", 48: "Orchestral percussion"}

# Columns follow TRACKS: keys, bass, guitar, melody, piccolo, two fills,
# synth accents, sax, kit, strings, trumpet, brass, whistle, muted guitar.
# None means omit this part. Instrument choice and inclusion are independent.
ARRANGEMENTS = {
    "pop": SOURCE_PROGRAMS,
    "ballad": [0, 42, 46, 40, 73, None, None, 48, 71, 40, 40, 60, 60, 73, 46],
    "rock": [16, 34, 29, 30, None, None, None, 29, 65, 16, 16, 56, 61, None, 29],
    "techno": [5, 38, None, 81, None, None, None, 81, None, 25, 89, None, None, None, None],
}

def instrument_label(track_id, voice):
    if track_id == 'track-10':
        return DRUM_KIT_NAMES.get(voice, f"Drum kit {voice}")
    return GM_NAMES.get(voice, f"GM program {voice + 1}")

def default_tracks():
    return {tid: {"active": True, "voice": voice, "gain": 1.0}
            for (tid, _), voice in zip(TRACKS, SOURCE_PROGRAMS)}

# The MIDI notation is always the same; presets choose audible parts and the SC
# synth family used to render them. Drums stay enabled where a genre needs them.
GENRE_PRESETS = {
    "pop": ("Pop", 0, 0),
    "ballad": ("Ballad", .24, .01),
    "rock": ("Rock", .10, .20),
    "techno": ("Techno", .035, 0),
}

@dataclass
class MixerState:
    playing: bool = False
    speed: float = 1.0
    position: float = 0.0
    changed_at: float = field(default_factory=time.monotonic)
    genre: str | None = "pop"
    tracks: dict[str, dict] = field(default_factory=default_tracks)

    def current_position(self):
        return min(self.position + (time.monotonic() - self.changed_at) * self.speed, DURATION) if self.playing else self.position
    def snapshot(self):
        self.position = self.current_position(); self.changed_at = time.monotonic()

class Relay:
    def __init__(self): self.listeners=set(); self.encoder_connected=False; self.lock=asyncio.Lock()
    async def publish(self, chunk):
        async with self.lock: listeners=tuple(self.listeners)
        for queue in listeners:
            if queue.full():
                try: queue.get_nowait()
                except asyncio.QueueEmpty: pass
            queue.put_nowait(chunk)
    async def subscribe(self, prebuffer):
        queue=asyncio.Queue(maxsize=512)
        async with self.lock: self.listeners.add(queue)
        try:
            chunks=[]; deadline=time.monotonic()+prebuffer
            while time.monotonic()<deadline:
                try: chunks.append(await asyncio.wait_for(queue.get(), deadline-time.monotonic()))
                except TimeoutError: break
            if chunks: yield b"".join(chunks)
            while True: yield await queue.get()
        finally:
            async with self.lock: self.listeners.discard(queue)

state= MixerState(); relay=Relay()
def send_osc(address, value=None):
    try: SimpleUDPClient(ENGINE_HOST, ENGINE_PORT).send_message(address, [] if value is None else value)
    except OSError: pass
def sync_tracks():
    payload=[]
    for track_id, _ in TRACKS:
        item=state.tracks[track_id]; payload.extend((track_id, int(item["active"]), item["voice"], item["gain"]))
    send_osc("/midi/state", payload)
def response_state():
    if state.playing and state.current_position() >= DURATION:
        state.position=DURATION; state.playing=False; state.changed_at=time.monotonic(); send_osc("/transport/pause")
    return {"playing":state.playing,"speed":state.speed,"position":state.current_position(),"duration":DURATION,"genre":state.genre,"audio_connected":relay.encoder_connected,"song_bpm":SONG_BPM,"song_key":"MIDI note data","tracks":[{"id":tid,"name":name,**state.tracks[tid],"voice_name":instrument_label(tid,state.tracks[tid]["voice"])} for tid,name in TRACKS]}

def word_timed_lyrics():
    try:
        payload = json.loads(LYRICS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise HTTPException(404, "Word-timed lyrics are not available for this song") from error
    except json.JSONDecodeError as error:
        raise HTTPException(500, "Word-timed lyrics are invalid JSON") from error
    if not isinstance(payload, dict) or not isinstance(payload.get("words"), list):
        raise HTTPException(500, "Word-timed lyrics must contain a words array")
    return payload

class SpeedChange(BaseModel): speed: float=Field(ge=.5,le=1.5)
class SeekChange(BaseModel): position: float=Field(ge=0)
class TrackChange(BaseModel): active: Optional[bool]=None; gain: Optional[float]=Field(default=None,ge=0,le=1.5)

@asynccontextmanager
async def lifespan(_: FastAPI): yield
app=FastAPI(title="MIDI Genre Arranger",version="1.0",lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(CORS_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Content-Type"],
)
@app.get("/health")
async def health(): return {"status":"ok","audio_connected":relay.encoder_connected}
@app.get("/api/state")
async def get_state(): return response_state()
@app.get("/api/genres")
async def genres(): return [{"id":key,"label":value[0]} for key,value in GENRE_PRESETS.items()]
@app.get("/api/lyrics/word-timed")
async def get_word_timed_lyrics(): return word_timed_lyrics()
@app.put("/api/genres/{genre}")
async def apply_genre(genre: str):
    preset=GENRE_PRESETS.get(genre.lower())
    if not preset: raise HTTPException(404,f"Unknown genre: {genre}")
    _, reverb, drive=preset; state.genre=genre.lower()
    for i, track_id in enumerate(state.tracks):
        selected = ARRANGEMENTS[state.genre][i]
        if state.genre == "pop": gain = 1.0
        elif state.genre == "techno": gain = {
            "track-2": .94, "track-4": 1.0, "track-10": .73,
            "track-1": .82, "track-11": .32, "track-8": .45,
        }.get(track_id, .5)
        else: gain = .9 if track_id == 'track-4' else (.65 if track_id in {'track-5','track-14'} else .8)
        state.tracks[track_id].update(active=selected is not None,
            voice=SOURCE_PROGRAMS[i] if selected is None else selected,gain=gain)
    # Style arrives first so /midi/state rebuilds the Ppar with the right
    # genre-only rhythm layer while playback is already running.
    send_osc("/mixer/style",[reverb,drive,int(state.genre == "techno")]); sync_tracks(); return response_state()
@app.put("/api/tracks/{track_id}")
async def set_track(track_id: str, change: TrackChange):
    if track_id not in state.tracks: raise HTTPException(404,f"Unknown MIDI track: {track_id}")
    if change.active is not None: state.tracks[track_id]["active"]=change.active
    if change.gain is not None: state.tracks[track_id]["gain"]=change.gain
    state.genre=None; sync_tracks(); return response_state()
@app.post("/api/transport/play")
async def play():
    response_state()
    if state.position>=DURATION: state.position=0; send_osc("/transport/seek",0)
    if not state.playing:
        state.changed_at=time.monotonic(); state.playing=True
        sync_tracks(); send_osc("/transport/speed",state.speed)
        send_osc("/transport/seek",state.position); send_osc("/transport/play")
    return response_state()
@app.post("/api/transport/restart")
async def restart(): state.position=0;state.changed_at=time.monotonic();state.playing=True;send_osc("/transport/seek",0);sync_tracks();send_osc("/transport/play");return response_state()
@app.post("/api/transport/pause")
async def pause():
    if state.playing: state.snapshot();state.playing=False;send_osc("/transport/pause")
    return response_state()
@app.put("/api/transport/speed")
async def set_speed(change: SpeedChange): state.snapshot();state.speed=change.speed;send_osc("/transport/speed",change.speed);return response_state()
@app.put("/api/transport/seek")
async def seek(change: SeekChange):
    if change.position>DURATION: raise HTTPException(422,f"position must not exceed {DURATION:.3f} seconds")
    state.position=change.position;state.changed_at=time.monotonic();send_osc("/transport/seek",change.position);return response_state()
@app.put("/internal/audio",include_in_schema=False)
async def ingest_audio(request: Request):
    relay.encoder_connected=True
    try:
        try:
            async for chunk in request.stream():
                if chunk: await relay.publish(chunk)
        except ClientDisconnect: pass
    finally: relay.encoder_connected=False
    return {"status":"stream ended"}
@app.get("/api/audio/live.mp3")
async def live_audio(prebuffer: float=PREBUFFER_SECONDS): return StreamingResponse(relay.subscribe(min(max(prebuffer,.2),10)),media_type="audio/mpeg",headers={"Cache-Control":"no-store","X-Accel-Buffering":"no"})
