interface Props { title: string; className?: string }
export function PlaceholderPanel({ title, className = '' }: Props) { return <section className={`placeholder-panel ${className}`} aria-label={title}><h2>{title}</h2></section> }
