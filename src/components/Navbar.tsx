// V2 Navbar（design-v2 §7.1）：板面磨砂底 + 发丝线，激活态 = 静态手绘下划线
import { Link, NavLink, useLocation } from 'react-router'
import { UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import CrossMark from '@/components/board/CrossMark'
import { StaticUnderline } from '@/components/board/Mark'

const MATCH_TABS = [
  { label: '总览', to: (id: string) => `/match/${id}` },
  { label: '选手', to: (id: string) => `/match/${id}/player/me` },
  { label: '回合经济', to: (id: string) => `/match/${id}/rounds` },
  { label: '战术热力', to: (id: string) => `/match/${id}/tactics` },
  { label: '教练建议', to: (id: string) => `/match/${id}/coach` },
]

export default function Navbar() {
  const location = useLocation()
  const match = location.pathname.match(/^\/match\/([^/]+)/)
  const matchId = match?.[1]

  return (
    <header className="fixed top-0 z-50 h-14 w-full border-b border-line bg-board-0/85 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1360px] items-center gap-8 px-6 md:px-10">
        {/* Left: logo + 常驻准星 */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img src="/logo.svg" alt="RETAKE" className="h-6 w-6" />
          <span className="font-display text-sm font-bold uppercase tracking-[0.25em] text-ink-1">
            RETAKE<span className="text-volt">.</span>
          </span>
          <CrossMark size={12} className="ml-1 hidden sm:block" />
        </Link>

        {/* Center: nav links */}
        <nav className="hidden items-center gap-5 md:flex">
          <NavItem to="/" label="首页" end />
          {matchId &&
            MATCH_TABS.map((t) => (
              <NavItem
                key={t.label}
                to={t.to(matchId)}
                label={t.label}
                end={t.label === '总览'}
              />
            ))}
          <NavItem to="/history" label="历史对局" />
        </nav>

        {/* Right: upload + version */}
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden font-mono text-[10px] text-ink-3 sm:inline">
            v2 WAR ROOM
          </span>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-sm border border-volt/60 px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-volt transition-colors duration-200 hover:bg-volt hover:text-board-0"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            上传 Demo
          </Link>
        </div>
      </div>
    </header>
  )
}

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className="group relative">
      {({ isActive }) => (
        <span
          className={cn(
            'relative px-1 py-1 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-200',
            isActive ? 'text-ink-1' : 'text-ink-2 group-hover:text-ink-1',
          )}
        >
          {label}
          {isActive && <StaticUnderline />}
        </span>
      )}
    </NavLink>
  )
}
