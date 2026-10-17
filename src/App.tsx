import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Landing } from './pages/Landing'
import { EncryptPage } from './pages/EncryptPage'
import { DecryptPage } from './pages/DecryptPage'
import { KeysPage } from './pages/KeysPage'
import { NotFound } from './pages/NotFound'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/encrypt" element={<EncryptPage />} />
        <Route path="/decrypt" element={<DecryptPage />} />
        <Route path="/keys" element={<KeysPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
