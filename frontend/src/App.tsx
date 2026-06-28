import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import MessageDetail from './pages/MessageDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/message/:id" element={<MessageDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
