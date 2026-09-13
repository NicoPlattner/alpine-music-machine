import type { WolpertingerEmotion } from './wolpertingerEmotion'

interface WolpertingerProps {
  emotion: WolpertingerEmotion
  reaction?: string
}

const asset = (name: string) => `${import.meta.env.BASE_URL}leo-visual/UI/Wolp/${name}`

// No dedicated neutral artwork exists yet, so the calm happy drawing is the
// neutral visual fallback. Wolp_shame.png remains archived but is not reachable.
export const WOLPERTINGER_ASSETS: Record<WolpertingerEmotion, string> = {
  neutral: asset('Wolp_happy.png'),
  dead: asset('Wolp_dead.png'),
  happy: asset('Wolp_happy.png'),
  heartEyes: asset('Wolp_love.png'),
}

export function WolpertingerLayer({ emotion, reaction }: WolpertingerProps) {
  return (
    <div className="leo-wolpertinger-score-anchor" aria-label={`Wolpertinger: ${emotion}`} data-emotion={emotion}>
      <img key={emotion} className="leo-wolpertinger wolpertinger-emotion-art" src={WOLPERTINGER_ASSETS[emotion]} alt="Wolpertinger" />
      {reaction && <strong>{reaction}</strong>}
    </div>
  )
}
