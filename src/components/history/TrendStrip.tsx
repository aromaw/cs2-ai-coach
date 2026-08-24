// V2 历史页 S1 趋势条（history.md）：近 12 场个人 Rating 走势，裸放板面。
// volt 线 2px + 数据点小圆 + 均值参考虚线；最高峰（生涯之夜）外套荧光笔手绘圈（本页标记 1/1）。
import { useMemo } from 'react'
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { motion } from 'framer-motion'
import { isWin, shortDate } from './demo-data'
import type { HistoryEntry } from './demo-data'

interface TrendPoint {
  date: string
  rating: number
  tip: string
  peak: boolean
}

/** 手绘感椭圆 path（围绕 cx,cy，直径约 28px，控制点轻微抖动写死） */
function peakCirclePath(cx: number, cy: number) {
  return [
    `M ${cx + 1} ${cy - 14}`,
    `C ${cx + 9} ${cy - 15}, ${cx + 15} ${cy - 7}, ${cx + 14} ${cy + 1}`,
    `C ${cx + 13} ${cy + 10}, ${cx + 6} ${cy + 15}, ${cx - 1} ${cy + 14}`,
    `C ${cx - 9} ${cy + 13}, ${cx - 15} ${cy + 7}, ${cx - 14} ${cy - 1}`,
    `C ${cx - 13} ${cy - 10}, ${cx - 7} ${cy - 14}, ${cx + 1} ${cy - 14}`,
  ].join(' ')
}

interface DotProps {
  cx?: number
  cy?: number
  payload?: TrendPoint
}

/** 数据点：折线画完后一次淡入；最高峰附荧光笔圈（draw 0.8s） */
function TrendDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined) return null
  return (
    <g>
      <motion.circle
        cx={cx}
        cy={cy}
        r={3}
        fill="#C8FF3D"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.0 }}
      />
      {payload?.peak && (
        <motion.path
          d={peakCirclePath(cx, cy)}
          fill="none"
          stroke="#C8FF3D"
          strokeWidth={2}
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 5px rgba(200,255,61,0.35))' }}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: { duration: 0.8, delay: 1.6, ease: [0.4, 0, 0.2, 1] },
            opacity: { duration: 0.01, delay: 1.6 },
          }}
        />
      )}
    </g>
  )
}

interface TipProps {
  active?: boolean
  payload?: Array<{ payload: TrendPoint }>
}

function TrendTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-sm border border-line bg-board-3 px-3 py-1.5 font-mono text-[11px] tabular-nums text-ink-1">
      {payload[0].payload.tip}
    </div>
  )
}

export default function TrendStrip({ entries }: { entries: HistoryEntry[] }) {
  const { data, avg, domain } = useMemo(() => {
    const chrono = [...entries].sort(
      (a, b) => +new Date(a.match.playedAt) - +new Date(b.match.playedAt),
    )
    const ratings = chrono.map((e) => e.stats?.rating ?? 0)
    const maxR = Math.max(...ratings)
    const minR = Math.min(...ratings)
    const mean = ratings.reduce((s, r) => s + r, 0) / (ratings.length || 1)
    const points: TrendPoint[] = chrono.map((e) => {
      const m = e.match
      const r = e.stats?.rating ?? 0
      const win = isWin(m)
      const score = `${Math.max(m.scoreT, m.scoreCT)}-${Math.min(m.scoreT, m.scoreCT)}`
      return {
        date: shortDate(m.playedAt),
        rating: r,
        tip: `${shortDate(m.playedAt)} · ${m.displayMap} · ${r.toFixed(2)} · ${win ? 'W' : 'L'} ${score}`,
        peak: r === maxR,
      }
    })
    return {
      data: points,
      avg: mean,
      domain: [Math.max(0, +(minR - 0.1).toFixed(2)), +(maxR + 0.12).toFixed(2)] as [number, number],
    }
  }, [entries])

  return (
    <div className="h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 44, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fill: '#5B6873', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            axisLine={{ stroke: '#222C37' }}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis hide domain={domain} />
          <Tooltip
            content={<TrendTip />}
            cursor={{ stroke: '#33404E', strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <ReferenceLine
            y={avg}
            stroke="#5B6873"
            strokeDasharray="3 3"
            label={{
              value: `AVG ${avg.toFixed(2)}`,
              position: 'right',
              fill: '#5B6873',
              fontSize: 9,
              fontFamily: 'JetBrains Mono',
            }}
          />
          <Line
            type="monotone"
            dataKey="rating"
            stroke="#C8FF3D"
            strokeWidth={2}
            dot={<TrendDot />}
            activeDot={{ r: 4, fill: '#C8FF3D', stroke: '#0A0D10' }}
            isAnimationActive
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
