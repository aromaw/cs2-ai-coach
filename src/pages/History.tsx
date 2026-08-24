// /history — V2 作战记录墙（design-v2/history.md）：一条克制的趋势线 + 发丝线对局清单。
// 数据：useMatchHistory()（真实记录）+ DEMO_HISTORY 12 场示例；动效仅白名单内
// （折线 draw 1.2s / 数据点一次淡入 / 荧光笔圈 / 三读数 count-up 0.8s / 筛选 0.25s 淡入）。
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router'
import { Search, UploadCloud } from 'lucide-react'
import { useMatchHistory } from '@/lib/match-data'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CrossMark from '@/components/board/CrossMark'
import SectionHeader from '@/components/board/SectionHeader'
import TrendStrip from '@/components/history/TrendStrip'
import MatchRow from '@/components/history/MatchRow'
import EmptyState from '@/components/history/EmptyState'
import { DEMO_HISTORY, isWin } from '@/components/history/demo-data'
import type { HistoryEntry } from '@/components/history/demo-data'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

type ResultFilter = 'all' | 'win' | 'loss'

/** 三读数 count-up（0.8s，白名单动效） */
function useCountUp(value: number, duration = 800): number {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    let raf = 0
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / duration)
      setDisplay(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return display
}

function HistorySkeleton() {
  return (
    <div className="mt-8 space-y-8">
      <Skeleton className="h-[160px] w-full rounded-sm bg-board-1" />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64 rounded-sm bg-board-1" />
        <Skeleton className="h-9 w-36 rounded-sm bg-board-1" />
        <Skeleton className="h-9 w-28 rounded-sm bg-board-1" />
      </div>
      <div className="space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-sm bg-board-1" />
        ))}
      </div>
    </div>
  )
}

export default function History() {
  const { items, isLoading, isFallback } = useMatchHistory()

  const [query, setQuery] = useState('')
  const [mapFilter, setMapFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [removedIds, setRemovedIds] = useState<number[]>([])

  // 真实上传记录（id > 0）在前；其后接 12 场示例数据
  const entries = useMemo<HistoryEntry[]>(() => {
    const real: HistoryEntry[] = items
      .filter((m) => m.id > 0)
      .map((m) => ({ match: m, demo: false }))
    return [...real, ...DEMO_HISTORY]
  }, [items])

  const visible = useMemo(
    () => entries.filter((e) => !removedIds.includes(e.match.id)),
    [entries, removedIds],
  )

  const mapOptions = useMemo(() => {
    const set = new Map<string, string>()
    visible.forEach((e) => set.set(e.match.displayMap, e.match.displayMap))
    return [...set.values()]
  }, [visible])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visible.filter((e) => {
      if (mapFilter !== 'all' && e.match.displayMap !== mapFilter) return false
      if (resultFilter === 'win' && !isWin(e.match)) return false
      if (resultFilter === 'loss' && isWin(e.match)) return false
      if (
        q &&
        !e.match.teamTName.toLowerCase().includes(q) &&
        !e.match.teamCTName.toLowerCase().includes(q)
      )
        return false
      return true
    })
  }, [visible, query, mapFilter, resultFilter])

  // 趋势条与三读数基于带个人指标的对局（近 12 场）
  const statsEntries = useMemo(() => visible.filter((e) => e.stats), [visible])

  const summary = useMemo(() => {
    const wins = statsEntries.filter((e) => isWin(e.match)).length
    const total = statsEntries.length
    const winRate = total ? Math.round((wins / total) * 100) : 0
    const ratings = statsEntries.map((e) => e.stats?.rating ?? 0)
    const avg = total ? ratings.reduce((s, r) => s + r, 0) / total : 0
    // 近 30 天变化：时间轴后半均值 − 前半均值
    const chrono = [...statsEntries].sort(
      (a, b) => +new Date(a.match.playedAt) - +new Date(b.match.playedAt),
    )
    const half = Math.floor(chrono.length / 2)
    const delta =
      chrono.length >= 2 && half > 0
        ? chrono.slice(half).reduce((s, e) => s + (e.stats?.rating ?? 0), 0) /
            (chrono.length - half) -
          chrono.slice(0, half).reduce((s, e) => s + (e.stats?.rating ?? 0), 0) / half
        : 0
    const mapCount = new Map<string, number>()
    statsEntries.forEach((e) =>
      mapCount.set(e.match.displayMap, (mapCount.get(e.match.displayMap) ?? 0) + 1),
    )
    let topMap = '—'
    let topCount = 0
    mapCount.forEach((count, map) => {
      if (count > topCount) {
        topMap = map
        topCount = count
      }
    })
    return { wins, losses: total - wins, winRate, avg, delta, topMap, topCount }
  }, [statsEntries])

  const winRateDisplay = useCountUp(summary.winRate)
  const avgDisplay = useCountUp(summary.avg)

  const resetFilters = () => {
    setQuery('')
    setMapFilter('all')
    setResultFilter('all')
  }

  return (
    <div className="mx-auto max-w-[1360px] px-6 pb-16 pt-10 md:px-10">
      {/* S1 — 页面头 + 长期趋势 */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3">
            <CrossMark size={16} />
            <h1 className="font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink-1">
              历史对局
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
              Match History
            </span>
          </div>
          <p className="mt-2 pl-7 font-mono text-xs text-ink-3">
            共 {visible.length} 场已解析 · 近 30 天
            {isFallback && ' · 离线模式'}
          </p>
        </div>
        <Link
          to="/"
          className="flex items-center gap-2 rounded-sm border border-volt/60 px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-volt transition-colors duration-200 hover:bg-volt hover:text-board-0"
        >
          <UploadCloud className="h-3.5 w-3.5" />
          上传新 Demo
        </Link>
      </motion.header>

      {isLoading ? (
        <HistorySkeleton />
      ) : visible.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* 趋势条：左 8 列折线 + 右 4 列裸读数 */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
            className="mt-8 grid gap-10 lg:grid-cols-12"
          >
            <div className="lg:col-span-8">
              {statsEntries.length > 0 && <TrendStrip entries={statsEntries} />}
            </div>
            <div className="flex flex-col justify-center divide-y divide-line/60 lg:col-span-4">
              <div className="py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
                  胜率
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums leading-none text-ink-1">
                  {Math.round(winRateDisplay)}%
                </p>
                <p className="mt-1.5 font-mono text-xs text-ink-3">
                  {summary.wins}W – {summary.losses}L
                </p>
              </div>
              <div className="py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
                  平均 Rating
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums leading-none text-ink-1">
                  {avgDisplay.toFixed(2)}
                </p>
                <p
                  className={cn(
                    'mt-1.5 font-mono text-xs',
                    summary.delta >= 0 ? 'text-success' : 'text-danger',
                  )}
                >
                  {summary.delta >= 0 ? '▲' : '▼'} {summary.delta >= 0 ? '+' : ''}
                  {summary.delta.toFixed(2)} 近 30 天
                </p>
              </div>
              <div className="py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
                  最常用地图
                </p>
                <p className="mt-1 font-display text-2xl font-bold uppercase leading-none text-ink-1">
                  {summary.topMap}
                </p>
                <p className="mt-1.5 font-mono text-xs text-ink-3">×{summary.topCount} 场</p>
              </div>
            </div>
          </motion.section>

          {/* S2 — 筛选条 + 对局清单 */}
          <section className="mt-10 border-t border-line py-10">
            <SectionHeader title="对局清单" en="MATCH LIST" />

            {/* 筛选条 */}
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative md:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索玩家 / 队名…"
                  className="h-9 rounded-sm border-line bg-board-1 pl-9 text-sm text-ink-1 placeholder:text-ink-3 focus-visible:border-line-strong focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Select value={mapFilter} onValueChange={setMapFilter}>
                  <SelectTrigger className="h-9 w-[140px] rounded-sm border-line bg-board-1 text-sm text-ink-2 focus:ring-0 focus:ring-offset-0">
                    <SelectValue placeholder="全部地图" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border-line bg-board-3">
                    <SelectItem
                      value="all"
                      className="text-ink-2 focus:bg-board-2 focus:text-ink-1"
                    >
                      全部地图
                    </SelectItem>
                    {mapOptions.map((m) => (
                      <SelectItem
                        key={m}
                        value={m}
                        className="text-ink-2 focus:bg-board-2 focus:text-ink-1"
                      >
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={resultFilter}
                  onValueChange={(v) => setResultFilter(v as ResultFilter)}
                >
                  <SelectTrigger className="h-9 w-[110px] rounded-sm border-line bg-board-1 text-sm text-ink-2 focus:ring-0 focus:ring-offset-0">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border-line bg-board-3">
                    <SelectItem
                      value="all"
                      className="text-ink-2 focus:bg-board-2 focus:text-ink-1"
                    >
                      全部
                    </SelectItem>
                    <SelectItem
                      value="win"
                      className="text-ink-2 focus:bg-board-2 focus:text-ink-1"
                    >
                      胜
                    </SelectItem>
                    <SelectItem
                      value="loss"
                      className="text-ink-2 focus:bg-board-2 focus:text-ink-1"
                    >
                      负
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 对局清单（发丝线行，筛选变化 0.25s 淡入更新） */}
            {filtered.length === 0 ? (
              <div className="py-14 text-center">
                <p className="font-display text-base font-semibold uppercase tracking-widest text-ink-2">
                  没有符合条件的对局
                </p>
                <p className="mt-2 text-sm text-ink-3">试试更换地图或清空搜索关键词。</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 rounded-sm border border-volt/60 px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-volt transition-colors duration-200 hover:bg-volt hover:text-board-0"
                >
                  重置筛选
                </button>
              </div>
            ) : (
              <motion.div
                key={`${query}|${mapFilter}|${resultFilter}|${removedIds.length}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                {filtered.map((e) => (
                  <MatchRow
                    key={e.match.id}
                    entry={e}
                    onRemove={(id) => setRemovedIds((prev) => [...prev, id])}
                  />
                ))}
              </motion.div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
