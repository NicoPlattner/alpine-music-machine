import type { BackendState } from './api/audioApiTypes'
import type { AudioStreamStatus } from './useAudioBackend'

interface Props { state: BackendState | null; connected: boolean; streamStatus: AudioStreamStatus }

export function BackendDebugPanel({ state, connected, streamStatus }: Props) {
  if (!import.meta.env.DEV) return null
  return (
    <details className="backend-debug">
      <summary>Audio diagnostics</summary>
      <span>Backend: {connected ? 'connected' : 'unavailable'}</span>
      <span>Audio stream: {streamStatus}</span>
      <span>Audio engine: {state?.audio_connected ? 'connected' : 'disconnected'}</span>
      <span>Playing: {state?.playing ? 'yes' : 'no'}</span>
      <span>Genre: {state?.genre ?? 'custom / unknown'}</span>
      <span>Speed: {state?.speed.toFixed(2) ?? '—'}×</span>
      <span>Position: {state?.position.toFixed(2) ?? '—'} s</span>
      <span>Duration: {state?.duration.toFixed(2) ?? '—'} s</span>
      <span>Song BPM: {state?.song_bpm ?? '—'}</span>
    </details>
  )
}
