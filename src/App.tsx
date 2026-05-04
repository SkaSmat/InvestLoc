import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AnalyzePage } from '@/pages/AnalyzePage'
import { OpportunitiesPage } from '@/pages/OpportunitiesPage'
import { SettingsPage } from '@/pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<AnalyzePage />} />
          <Route path="opportunities" element={<OpportunitiesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
