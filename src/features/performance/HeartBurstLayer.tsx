import { useEffect, useRef, useState, type CSSProperties } from 'react'

interface HeartParticle {
  id: number
  x: number
  y: number
  dx: number
  rise: number
  scale: number
  rot: number
  dur: number
  delay: number
}

interface HeartBurstLayerProps {
  /** Any value that changes to trigger a new burst (e.g. the active lyric line index). Negative values are ignored. */
  triggerKey: number
}

const HEART_ASSET = `${import.meta.env.BASE_URL}leo-visual/UI/Wolp/heart_points.svg`
const HEART_BURST_COUNT = 100

function createHeartBurst(nextId: () => number): HeartParticle[] {
  return Array.from({ length: HEART_BURST_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2
    const dist = 20 + Math.random() * 100
    return {
      id: nextId(),
      x: window.innerWidth * (0.05 + Math.random() * 0.9),
      y: window.innerHeight * (0.4 + Math.random() * 0.55),
      dx: Math.cos(angle) * dist,
      rise: 380 + Math.random() * 420,
      scale: 0.7 + Math.random() * 3,
      rot: (Math.random() - 0.5) * 60,
      dur: 2.6 + Math.random() * 1.8,
      delay: Math.random() * 0.6,
    }
  })
}

export function HeartBurstLayer({ triggerKey }: HeartBurstLayerProps) {
  const [hearts, setHearts] = useState<HeartParticle[]>([])
  const idRef = useRef(0)
  const previousTrigger = useRef(triggerKey)

  useEffect(() => {
    if (triggerKey === previousTrigger.current) return
    previousTrigger.current = triggerKey
    if (triggerKey < 0) return
    setHearts((current) => [...current, ...createHeartBurst(() => idRef.current++)])
  }, [triggerKey])

  const removeHeart = (id: number) => setHearts((current) => current.filter((heart) => heart.id !== id))

  return (
    <div className="leo-heart-layer" aria-hidden="true">
      {hearts.map((heart) => (
        <img
          key={heart.id}
          className="heart-particle"
          src={HEART_ASSET}
          alt=""
          style={{
            '--x': `${heart.x}px`,
            '--y': `${heart.y}px`,
            '--dx': `${heart.dx}px`,
            '--rise': `${heart.rise}px`,
            '--scale': heart.scale,
            '--rot': `${heart.rot}deg`,
            '--dur': `${heart.dur}s`,
            animationDelay: `${heart.delay}s`,
          } as CSSProperties}
          onAnimationEnd={() => removeHeart(heart.id)}
        />
      ))}
    </div>
  )
}
