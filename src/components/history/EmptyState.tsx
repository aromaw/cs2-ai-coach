// V2 历史页空状态（history.md §2.3）：纯 SVG 准星插画（48px 准星 + 静态手绘 volt 圈），完全静态。
import { Link } from 'react-router'
import CrossMark from '@/components/board/CrossMark'

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="relative inline-block p-4">
        <CrossMark size={48} />
        {/* 外围一圈静态手绘 volt 圆圈 */}
        <svg
          viewBox="0 0 100 60"
          preserveAspectRatio="none"
          className="pointer-events-none absolute overflow-visible"
          style={{ left: '-16%', right: '-16%', top: '-22%', bottom: '-22%' }}
          aria-hidden
        >
          <path
            d="M 52 4 C 78 3, 98 14, 97 30 C 96 48, 74 58, 48 57 C 24 56, 4 46, 5 29 C 6 13, 28 2, 54 4"
            fill="none"
            stroke="#C8FF3D"
            strokeWidth={2}
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 4px rgba(200,255,61,0.3))' }}
          />
        </svg>
      </div>
      <p className="mt-6 font-display text-lg font-semibold uppercase tracking-[0.15em] text-ink-1">
        还没有分析记录
      </p>
      <p className="mt-2 text-sm text-ink-2">上传你的第一场 Demo，开始建立个人数据库。</p>
      <Link
        to="/"
        className="mt-6 rounded-sm bg-volt px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-board-0 transition-[filter] duration-200 hover:brightness-110"
      >
        上传 Demo
      </Link>
    </div>
  )
}
