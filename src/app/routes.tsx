import { Navigate, Route, Routes } from 'react-router-dom'
import { PerformancePage } from '../pages/PerformancePage'
import { ResultsPage } from '../pages/ResultsPage'
import { SongPickerPage } from '../pages/SongPickerPage'
export function AppRoutes() {
  return <Routes><Route path="/" element={<SongPickerPage />} /><Route path="/performance/:songId" element={<PerformancePage />} /><Route path="/results" element={<ResultsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>
}
