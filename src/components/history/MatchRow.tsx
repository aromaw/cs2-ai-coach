// V2 历史页 S2 对局行（history.md §2.2）：发丝线行列表，无卡片。
// 整行可点进 /match/:id；hover 仅 bg-board-2/60（无位移、无浮起）。
import { useNavigate } from 'react-router'
import { MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatDateTime, isWin, matchPath } from './demo-data'
import type { HistoryEntry } from './demo-data'

interface MatchRowProps {
  entry: HistoryEntry
  onRemove: (id: number) => void
}

/** Rating 着色：≥1.10 good / 0.90–1.10 ink-1 / <0.90 bad */
function ratingClass(rating: number): string {
  if (rating >= 1.1) return 'text-success'
  if (rating >= 0.9) return 'text-ink-1'
  return 'text-danger'
}

export default function MatchRow({ entry, onRemove }: MatchRowProps) {
  const { match: m, stats } = entry
  const navigate = useNavigate()
  const win = isWin(m)
  const path = matchPath(m.id)
  const winnerScore = Math.max(m.scoreT, m.scoreCT)
  const loserScore = Math.min(m.scoreT, m.scoreCT)

  return (
    <article
      onClick={() => navigate(path)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(path)}
      tabIndex={0}
      className={cn(
        'group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-line/60 py-4',
        'transition-colors duration-200 hover:bg-board-2/60 focus:outline-none focus-visible:bg-board-2/60',
        'md:grid-cols-12 md:gap-x-0',
      )}
    >
      {/* 列 1：胜负标记（2px 竖条 + W/L） */}
      <div className="flex items-center gap-2 md:col-span-1">
        <span className={cn('h-8 w-0.5', win ? 'bg-success' : 'bg-danger')} aria-hidden />
        <span
          className={cn('font-mono text-xs font-bold', win ? 'text-success' : 'text-danger')}
        >
          {win ? 'W' : 'L'}
        </span>
      </div>

      {/* 列 2–4：比分块 + 队名 */}
      <div className="min-w-0 md:col-span-3">
        <p className="font-mono text-2xl font-bold tabular-nums leading-none">
          <span className="text-volt">{winnerScore}</span>
          <span className="mx-1.5 text-ink-3">:</span>
          <span className="text-ink-2">{loserScore}</span>
        </p>
        <p className="mt-1.5 truncate text-xs text-ink-2">
          {m.teamTName} <span className="text-ink-3">vs</span> {m.teamCTName}
        </p>
        {/* 移动端补充信息 */}
        <p className="mt-1 truncate font-mono text-[10px] text-ink-3 md:hidden">
          {m.displayMap.toUpperCase()} · MR12 · {formatDateTime(m.playedAt)}
          {stats && <> · RTG {stats.rating.toFixed(2)}</>}
        </p>
      </div>

      {/* 列 5–6：地图 + 赛制/时间 */}
      <div className="hidden md:col-span-2 md:block">
        <p className="font-display text-sm font-semibold uppercase tracking-wider text-ink-1">
          {m.displayMap}
        </p>
        <p className="mt-1 font-mono text-[10px] text-ink-3">
          MR12 · {formatDateTime(m.playedAt)}
        </p>
      </div>

      {/* 列 7–9：个人数据横排 */}
      <div className="hidden md:col-span-3 md:flex md:items-center md:gap-4 md:font-mono md:text-xs md:tabular-nums">
        {stats ? (
          <>
            <span className="text-ink-2">
              K/D <span className="text-ink-1">{stats.kills}/{stats.deaths}</span>
            </span>
            <span className="text-ink-2">
              ADR <span className="text-ink-1">{stats.adr.toFixed(1)}</span>
            </span>
            <span className="text-ink-2">
              RTG{' '}
              <span className={cn('font-bold', ratingClass(stats.rating))}>
                {stats.rating.toFixed(2)}
              </span>
            </span>
          </>
        ) : (
          <span className="text-ink-3">个人指标见复盘详情</span>
        )}
      </div>

      {/* 列 10–12：复盘入口 + 更多菜单 */}
      <div className="flex items-center justify-end gap-1 md:col-span-3">
        <span className="hidden font-mono text-xs text-ink-2 transition-colors duration-200 group-hover:text-volt sm:inline">
          复盘 →
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="更多操作"
              onClick={(e) => e.stopPropagation()}
              className="rounded-sm p-1.5 text-ink-3 transition-colors duration-200 hover:bg-board-2 hover:text-ink-1"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-sm border-line bg-board-3">
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-ink-2 focus:bg-board-2 focus:text-ink-1"
              onClick={(e) => {
                e.stopPropagation()
                navigate(path)
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重新解析
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-danger focus:bg-board-2 focus:text-danger"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(m.id)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}
