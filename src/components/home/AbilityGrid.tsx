// V2 落地页 S2 — 三格能力预览（home.md）：竖发丝线分隔（非卡片），纯 CSS/SVG 微缩 UI，静态无动画。

/** 迷你记分板线稿：三行发丝线 + mono 数字，MVP 行一个静态 volt 手绘小圈 */
function MiniScoreboard() {
  const rows = [
    { name: 's1mple丶Fan', kd: '24/15', rtg: '1.34', mvp: true },
    { name: 'NiKo_Fan', kd: '19/16', rtg: '1.08', mvp: false },
    { name: 'donk666', kd: '14/18', rtg: '0.87', mvp: false },
  ]
  return (
    <div className="flex h-full flex-col justify-center">
      {rows.map((r) => (
        <div
          key={r.name}
          className="flex items-center gap-3 border-b border-line/60 py-1.5 font-mono text-[10px] tabular-nums last:border-b-0"
        >
          <span className="w-20 truncate text-ink-2">{r.name}</span>
          <span className="ml-auto text-ink-3">{r.kd}</span>
          <span className="relative inline-block px-1 py-0.5 text-ink-1">
            {r.rtg}
            {r.mvp && (
              <svg
                viewBox="0 0 100 60"
                preserveAspectRatio="none"
                className="pointer-events-none absolute overflow-visible"
                style={{ left: '-14%', right: '-14%', top: '-30%', bottom: '-30%' }}
                aria-hidden
              >
                <path
                  d="M 52 4 C 78 3, 98 14, 97 30 C 96 48, 74 58, 48 57 C 24 56, 4 46, 5 29 C 6 13, 28 2, 54 4"
                  fill="none"
                  stroke="#C8FF3D"
                  strokeWidth={3}
                  strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(200,255,61,0.3))' }}
                />
              </svg>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 迷你经济曲线：amber/blue 双阶梯折线（静态 SVG） */
function MiniEconomy() {
  // 逐回合经济走势（0–100 归一化，值越大线越高）
  const tSide = [18, 26, 22, 34, 42, 38, 52, 60, 56, 70, 82, 92]
  const ctSide = [80, 72, 78, 64, 58, 62, 48, 42, 46, 32, 22, 12]
  const toStep = (vals: number[]) => {
    const w = 200 / (vals.length - 1)
    return vals
      .map((v, i) => {
        const x = +(i * w).toFixed(1)
        const y = +(88 - v * 0.8).toFixed(1)
        if (i === 0) return `M ${x} ${y}`
        const px = +((i - 1) * w).toFixed(1)
        return `L ${px} ${y} L ${x} ${y}`
      })
      .join(' ')
  }
  return (
    <svg viewBox="0 0 200 96" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
      <line x1="0" y1="88" x2="200" y2="88" stroke="#222C37" strokeWidth="1" />
      <path d={toStep(ctSide)} fill="none" stroke="#4DA3FF" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={toStep(tSide)} fill="none" stroke="#FFB020" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/** 迷你热力图：地图方框线稿 + 3 个静态热力点（红/橙径向渐变，mix-blend-screen） */
function MiniHeatmap() {
  return (
    <svg viewBox="0 0 200 96" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="dz-heat-red">
          <stop offset="0%" stopColor="#FF5252" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FF5252" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dz-heat-amber">
          <stop offset="0%" stopColor="#FFB020" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FFB020" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 地图方框 + 内部墙线 */}
      <rect x="8" y="6" width="184" height="84" fill="none" stroke="#33404E" strokeWidth="1" />
      <line x1="76" y1="6" x2="76" y2="40" stroke="#222C37" strokeWidth="1" />
      <line x1="76" y1="58" x2="76" y2="90" stroke="#222C37" strokeWidth="1" />
      <line x1="140" y1="6" x2="140" y2="64" stroke="#222C37" strokeWidth="1" />
      <line x1="8" y1="50" x2="52" y2="50" stroke="#222C37" strokeWidth="1" />
      <g style={{ mixBlendMode: 'screen' }}>
        <circle cx="52" cy="32" r="22" fill="url(#dz-heat-red)" />
        <circle cx="150" cy="64" r="20" fill="url(#dz-heat-red)" />
        <circle cx="104" cy="50" r="14" fill="url(#dz-heat-amber)" />
      </g>
    </svg>
  )
}

const ABILITIES = [
  {
    no: '01',
    title: '比赛总览',
    en: 'SCOREBOARD',
    desc: '完整记分板、Rating 2.0、半场走势。谁在 carry，谁在拖后腿，一目了然。',
    preview: <MiniScoreboard />,
  },
  {
    no: '02',
    title: '回合经济',
    en: 'ECONOMY',
    desc: '逐回合时间线 + 双方经济曲线。每一次强起与 ECO，系统都判定其合理性。',
    preview: <MiniEconomy />,
  },
  {
    no: '03',
    title: '战术热力',
    en: 'HEATMAP',
    desc: '死亡与击杀热力、道具投掷点。你的每一次走位，都在地图上留下证据。',
    preview: <MiniHeatmap />,
  },
]

export default function AbilityGrid() {
  return (
    <div className="grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line/60">
      {ABILITIES.map((a) => (
        <div key={a.no} className="md:px-8 md:first:pl-0 md:last:pr-0">
          <p className="font-mono text-xs text-volt">{a.no}</p>
          <h3 className="mt-2 flex items-baseline gap-2 font-display text-base font-semibold uppercase text-ink-1">
            {a.title}
            <span className="font-mono text-[10px] font-medium tracking-[0.22em] text-ink-3">
              {a.en}
            </span>
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{a.desc}</p>
          <div className="mt-6 h-24">{a.preview}</div>
        </div>
      ))}
    </div>
  )
}
