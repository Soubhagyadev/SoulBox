import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Landing } from './pages/Landing'
import { EncryptPage } from './pages/EncryptPage'
import { BatchEncryptPage } from './pages/BatchEncryptPage'
import { DecryptPage } from './pages/DecryptPage'
import { KeysPage } from './pages/KeysPage'
import { SettingsPage } from './pages/SettingsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { NotFound } from './pages/NotFound'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/encrypt" element={<EncryptPage />} />
        <Route path="/batch" element={<BatchEncryptPage />} />
        <Route path="/decrypt" element={<DecryptPage />} />
        <Route path="/keys" element={<KeysPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
