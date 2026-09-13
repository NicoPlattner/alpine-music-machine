import { useNavigate } from 'react-router-dom'
import { usePerformanceStore } from '../store/performanceStore'
import { useKaraokeScoreStore } from '../features/karaoke/scoring/karaokeScoreStore'
import './leoPages.css'
export function ResultsPage() {
  const navigate = useNavigate(); const { selectedSongId, score, resetScore: resetPerformanceScore, resetPerformance } = usePerformanceStore()
  const { fivePointAwards, tenPointAwards, maxSingingStreak, resetScore: resetKaraokeScore } = useKaraokeScoreStore()
  const clearScore = () => { resetKaraokeScore(); resetPerformanceScore() }
  const playAgain = () => { clearScore(); navigate(selectedSongId ? `/performance/${selectedSongId}` : '/') }
  const chooseAnother = () => { clearScore(); resetPerformance(); navigate('/') }
  return <main className="results-page leo-page"><img className="leo-page-frame" src="/leo-visual/UI/Wolp/Frame.svg" alt="" /><img className="results-wolpertinger" src="/leo-visual/UI/Wolp/Wolp_happy.png" alt="Happy Wolpertinger" /><div className="leo-page-content results-content"><header><p className="status-label">Performance energy</p><h1>Summit reached!</h1></header><dl className="results-stats"><div className="score-main"><dt>Total participation score</dt><dd>{score.toLocaleString()}</dd></div><div><dt>Great +10</dt><dd>{tenPointAwards}</dd></div><div><dt>Good +5</dt><dd>{fivePointAwards}</dd></div><div><dt>Longest singing streak</dt><dd>{maxSingingStreak}</dd></div></dl><div className="result-actions"><button className="primary-button" onClick={playAgain}>Play Again</button><button className="secondary-button" onClick={chooseAnother}>Choose Another Song</button></div></div></main>
}
