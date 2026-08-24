import { Routes, Route } from 'react-router'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Overview from '@/pages/Overview'
import Player from '@/pages/Player'
import Rounds from '@/pages/Rounds'
import Tactics from '@/pages/Tactics'
import Coach from '@/pages/Coach'
import History from '@/pages/History'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="match/:id" element={<Overview />} />
        <Route path="match/:id/player/:pid" element={<Player />} />
        <Route path="match/:id/rounds" element={<Rounds />} />
        <Route path="match/:id/tactics" element={<Tactics />} />
        <Route path="match/:id/coach" element={<Coach />} />
        <Route path="history" element={<History />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
