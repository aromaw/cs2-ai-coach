import { Outlet } from 'react-router'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

/**
 * Shared layout. Navbar is `fixed top-0 h-14`, so this layout owns the
 * top offset (pt-14) for every page — pages must NOT add their own.
 * V2: 全站战术板网格纹理由此统一叠加（bg-board）。
 */
export default function Layout() {
  return (
    <div className="bg-board min-h-[100dvh] text-ink-1">
      <Navbar />
      <main className="pt-14">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
