interface PerformanceHUDProps {
  onFinish: () => void
}

export function PerformanceHUD({ onFinish }: PerformanceHUDProps) {
  return (
    <header className="stage-hud">
      <div className="hud-actions"><button onClick={onFinish} title="Finish performance (Esc)">Finish</button></div>
    </header>
  )
}
