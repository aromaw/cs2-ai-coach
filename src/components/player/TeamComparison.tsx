// V2 队内对比（player.md §3）：水平条形图，全队按指标降序，本人 volt 条，
// 全队均值竖直虚线（AVG）；指标切换时条宽 0.4s 过渡（信息动效，保留）。
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PlayerStat } from "@contracts/analysis";
import { StaticUnderline } from "@/components/board/Mark";

type MetricKey = "adr" | "kast" | "hs" | "rating" | "firstKills";

const METRICS: { key: MetricKey; label: string; format: (v: number) => string }[] = [
  { key: "adr", label: "ADR", format: (v) => v.toFixed(1) },
  { key: "kast", label: "KAST", format: (v) => `${v.toFixed(1)}%` },
  { key: "hs", label: "HS%", format: (v) => `${v.toFixed(1)}%` },
  { key: "rating", label: "RATING", format: (v) => v.toFixed(2) },
  { key: "firstKills", label: "首杀", format: (v) => String(Math.round(v)) },
];

function metricValue(p: PlayerStat, key: MetricKey): number {
  switch (key) {
    case "adr":
      return p.adr;
    case "kast":
      return p.kast;
    case "hs":
      return p.hsPercent;
    case "rating":
      return p.rating;
    case "firstKills":
      return p.firstKills;
  }
}

interface TeamComparisonProps {
  player: PlayerStat;
  players: PlayerStat[];
  isDefault: boolean;
}

export default function TeamComparison({ player, players, isDefault }: TeamComparisonProps) {
  const [metric, setMetric] = useState<MetricKey>("adr");
  const team = players.filter((p) => p.teamName === player.teamName);
  const roster = team.length > 0 ? team : players;

  const meta = METRICS.find((m) => m.key === metric)!;
  const sorted = [...roster].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  const max = Math.max(...sorted.map((p) => metricValue(p, metric)), 1e-6);
  const avg = sorted.reduce((s, p) => s + metricValue(p, metric), 0) / Math.max(1, sorted.length);
  const avgPct = Math.min(100, (avg / max) * 100);

  return (
    <div>
      {/* 指标切换 Tabs：激活 = volt 静态手绘下划线 */}
      <div className="flex items-center gap-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={cn(
              "relative px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-200",
              metric === m.key ? "text-ink-1" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {m.label}
            {metric === m.key && <StaticUnderline />}
          </button>
        ))}
      </div>

      <div className="relative mt-6 max-w-3xl">
        {/* 全队均值竖直虚线 */}
        {/* 条区几何：名字 140px + gap 16px + 条（flex-1）+ gap 16px + 数值 72px */}
        <span
          className="pointer-events-none absolute bottom-0 top-0 border-l border-dashed border-ink-3"
          style={{ left: `calc(156px + (100% - 244px) * ${avgPct / 100})` }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -top-5 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-3"
          style={{ left: `calc(156px + (100% - 244px) * ${avgPct / 100})` }}
          aria-hidden
        >
          AVG
        </span>

        <div className="space-y-3 pt-1">
          {sorted.map((p) => {
            const v = metricValue(p, metric);
            const isSelf = p.name === player.name;
            return (
              <div key={p.name} className="flex items-center gap-4">
                <span className="flex w-[140px] shrink-0 items-center gap-1.5 truncate font-mono text-xs text-ink-2">
                  <span className="truncate">{p.name}</span>
                  {isSelf && isDefault && (
                    <span className="rounded-sm border border-volt/50 px-1 font-mono text-[9px] font-bold text-volt">
                      YOU
                    </span>
                  )}
                </span>
                <div className="relative h-2 flex-1">
                  <motion.div
                    className={cn("absolute inset-y-0 left-0", isSelf ? "bg-volt" : "bg-board-3")}
                    initial={false}
                    animate={{ width: `${(v / max) * 100}%` }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <span
                  className={cn(
                    "w-[72px] shrink-0 text-right font-mono text-sm tabular-nums",
                    isSelf ? "text-volt" : "text-ink-1",
                  )}
                >
                  {meta.format(v)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
