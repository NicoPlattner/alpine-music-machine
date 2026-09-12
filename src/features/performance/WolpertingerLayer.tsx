interface WolpertingerProps { artworkUrl?: string; reaction?: string }
export function WolpertingerLayer({ artworkUrl, reaction }: WolpertingerProps) {
  return <div className="wolpertinger-layer" aria-label="Wolpertinger area">{artworkUrl ? <img src={artworkUrl} alt="Wolpertinger" /> : <div className="wolpertinger-placeholder"><span>Wolpertinger</span><small>Mascot area</small></div>}{reaction && <strong>{reaction}</strong>}</div>
}
