// V2 分区 3 — 团队对比 TEAM VS TEAM（overview.md §S3）
// 中心向两侧生长的双向对比条 + count-up 数值；无卡片，直接落在板面上
import { motion } from "framer-motion";
import type { AnalysisResult } from "@contracts/analysis";
import { teamAgg } from "./derive";
import CountUp from "./CountUp";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface Metric {
  label: string;
  t: number;
  ct: number;
  decimals: number;
  suffix: string;
}

function CompareRow({ m }: { m: Metric }) {
  const max = Math.max(m.t, m.ct, 0.01);
  const tPct = (m.t / max) * 100;
  const ctPct = (m.ct / max) * 100;

  return (
    <div className="grid h-11 grid-cols-[1fr_120px_1fr] items-center gap-3 md:gap-6">
      {/* 左：T 开局队伍（amber），条从中心向左生长 */}
      <div className="flex items-center justify-end gap-3">
        <span className="flex items-baseline gap-0.5 font-mono text-sm font-bold tabular-nums text-t-side">
          <CountUp value={m.t} decimals={m.decimals} duration={900} />
          {m.suffix && <span className="text-[10px] font-medium text-ink-3">{m.suffix}</span>}
        </span>
        <div className="relative h-1 flex-1 rounded-sm bg-board-2">
          <motion.div
            className="absolute right-0 top-0 h-full rounded-sm bg-t-side/70"
            initial={{ width: 0 }}
            whileInView={{ width: `${tPct}%` }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        </div>
      </div>
      {/* 中：指标名（固定 120px 居中列） */}
      <span className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
        {m.label}
      </span>
      {/* 右：CT 开局队伍（blue），条从中心向右生长 */}
      <div className="flex items-center gap-3">
        <div className="relative h-1 flex-1 rounded-sm bg-board-2">
          <motion.div
            className="absolute left-0 top-0 h-full rounded-sm bg-ct-side/70"
            initial={{ width: 0 }}
            whileInView={{ width: `${ctPct}%` }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        </div>
        <span className="flex items-baseline gap-0.5 font-mono text-sm font-bold tabular-nums text-ct-side">
          <CountUp value={m.ct} decimals={m.decimals} duration={900} />
          {m.suffix && <span className="text-[10px] font-medium text-ink-3">{m.suffix}</span>}
        </span>
      </div>
    </div>
  );
}

export default function TeamCompare({ data }: { data: AnalysisResult }) {
  const t = teamAgg(data.players, "T");
  const ct = teamAgg(data.players, "CT");

  const metrics: Metric[] = [
    { label: "总击杀", t: t.kills, ct: ct.kills, decimals: 0, suffix: "" },
    { label: "平均 ADR", t: t.avgAdr, ct: ct.avgAdr, decimals: 1, suffix: "" },
    { label: "KAST", t: t.avgKast, ct: ct.avgKast, decimals: 1, suffix: "%" },
    { label: "首杀", t: t.firstKills, ct: ct.firstKills, decimals: 0, suffix: "" },
    { label: "闪光助攻", t: t.flashAssists, ct: ct.flashAssists, decimals: 0, suffix: "" },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="grid grid-cols-[1fr_120px_1fr] items-center gap-3 md:gap-6">
        <span className="text-right font-mono text-xs font-bold uppercase tracking-[0.18em] text-t-side">
          {data.match.teamTName}
        </span>
        <span />
        <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-ct-side">
          {data.match.teamCTName}
        </span>
      </div>
      <div className="mt-4">
        {metrics.map((m) => (
          <CompareRow key={m.label} m={m} />
        ))}
      </div>
    </div>
  );
}
