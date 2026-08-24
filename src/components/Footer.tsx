// V2 Footer（design-v2 §7.8）：更矮更安静
import { Link } from 'react-router'

const LINKS = ['功能', '支持地图', '指标百科', '隐私']

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="RETAKE" className="h-6 w-6" />
          <span className="font-display text-sm font-bold uppercase tracking-[0.25em] text-ink-1">
            RETAKE<span className="text-volt">.</span>
          </span>
          <span className="ml-3 text-xs text-ink-3">一块懂 CS2 的战术板。</span>
        </div>
        <nav className="flex flex-wrap gap-5">
          {LINKS.map((l) => (
            <Link
              key={l}
              to="/"
              className="font-mono text-[11px] uppercase tracking-wider text-ink-3 transition-colors duration-200 hover:text-ink-1"
            >
              {l}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-ink-3">
          数据仅供个人复盘使用 · RETAKE is not affiliated with Valve.
        </p>
      </div>
    </footer>
  )
}
