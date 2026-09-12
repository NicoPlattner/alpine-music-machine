import { useNavigate } from 'react-router-dom'
import { usePerformanceStore } from '../store/performanceStore'
export function ResultsPage() {
  const navigate = useNavigate(); const { selectedSongId, score, maxCombo, singingAccuracy, resetPerformance } = usePerformanceStore()
  const playAgain = () => navigate(selectedSongId ? `/performance/${selectedSongId}` : '/')
  const chooseAnother = () => { resetPerformance(); navigate('/') }
  return <main className="results-page page-shell"><header><p className="status-label">Performance complete</p><h1>Summit reached.</h1></header><dl className="results-stats"><div><dt>Score</dt><dd>{score.toLocaleString()}</dd></div><div><dt>Max combo</dt><dd>{maxCombo}</dd></div><div><dt>Singing accuracy</dt><dd>{Math.round(singingAccuracy)}%</dd></div></dl><div className="result-actions"><button className="primary-button" onClick={playAgain}>Play Again</button><button className="secondary-button" onClick={chooseAnother}>Choose Another Song</button></div></main>
}
