import { AUDIO_API_BASE_URL } from '../../audio/api/audioApi'

export async function getNicoWordTimedLyrics(signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${AUDIO_API_BASE_URL}/api/lyrics/word-timed`, { signal })
  if (!response.ok) throw new Error(`Lyrics request failed (${response.status})`)
  return response.json() as Promise<unknown>
}
