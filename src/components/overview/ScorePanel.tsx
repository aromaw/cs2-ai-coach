// V2 分区 1 — 赛果板 SCORE（overview.md §S1）
// 巨型 mono 比分（胜方 volt + 荧光圈，本页标记 1/2）+ meta 行 + 半场分解条 + 24 回合速览条
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import type { AnalysisResult, RoundSummary } from "@contracts/analysis";
import Mark from "@/components/board/Mark";
import SideBadge from "@/components/match/SideBadge";
import RoundChip from "@/components/match/RoundChip";
import CountUp from "./CountUp";
import { computeHalfScore, halfSize } from "./derive";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

function formatDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

function formatDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** 半场分解条：一条 6px 分段条，颜色按队（不按半场阵营），数字两端对齐 */
function HalfBar({
  label,
  leftScore,
  rightScore,
  swap,
}: {
  label: string;
  leftScore: number;
  rightScore: number;
  /** 下半场换边：分界处小字标注 */
  swap?: boolean;
}) {
  const total = Math.max(1, leftScore + rightScore);
  const lp = (leftScore / total) * 100;
  const rp = (rightScore / total) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
        {label}
      </span>
      <span className="w-8 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-t-side">
        {leftScore}
      </span>
      <div className="relative flex-1">
        <div className="flex h-1.5 overflow-hidden rounded-sm bg-board-0">
          <motion.div
            className="h-full bg-t-side"
            initial={{ width: 0 }}
            whileInView={{ width: `${lp}%` }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.8, ease: EASE }}
          />
          <span className="h-full w-px shrink-0 bg-board-0" aria-hidden />
          <motion.div
            className="h-full bg-ct-side"
            initial={{ width: 0 }}
            whileInView={{ width: `${rp}%` }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        </div>
        {swap && (
          <span className="absolute left-1/2 top-2.5 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-3">
            换边
          </span>
        )}
      </div>
      <span className="w-8 shrink-0 font-mono text-sm font-bold tabular-nums text-ct-side">
        {rightScore}
      </span>
    </div>
  );
}

export default function ScorePanel({ data }: { data: AnalysisResult }) {
  const { match, rounds } = data;
  const navigate = useNavigate();

  const tWon = match.scoreT > match.scoreCT;
  const ctWon = match.scoreCT > match.scoreT;
  const halfAt = halfSize(rounds);
  const h1 = computeHalfScore(rounds, 1);
  const h2 = computeHalfScore(rounds, 2);
  // 颜色按队不按阵营：teamT 开局 T，下半场转 CT
  const h2TeamT = h2.ct;
  const h2TeamCT = h2.t;

  const conclusion =
    h2TeamT > h2TeamCT
      ? `${match.teamTName} 换边后 ${h2TeamT}:${h2TeamCT} 压住阵脚，直接锁死比赛。`
      : h2TeamCT > h2TeamT
        ? `${match.teamCTName} 换边后 ${h2TeamCT}:${h2TeamT} 反扑得手，扭转了走势。`
        : `下半场 ${h2TeamT}:${h2TeamCT} 战平，胜负早在上半场写就。`;

  const firstHalf = rounds.filter((r) => r.round <= halfAt);
  const secondHalf = rounds.filter((r) => r.round > halfAt);

  const scoreCell = (score: number, won: boolean) => (
    <span className="relative inline-block px-2">
      <CountUp
        value={score}
        duration={900}
        className={`font-mono text-7xl font-bold leading-none tracking-tight tabular-nums md:text-8xl ${
          won ? "text-volt" : "text-ink-2"
        }`}
      />
      {won && <Mark type="circle" delay={0.6} />}
    </span>
  );

  const roundRow = (label: string, list: RoundSummary[]) => (
    <div className="flex items-center gap-3">
      <span className="w-8 shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {list.map((r) => (
          <RoundChip
            key={r.round}
            round={r}
            onClick={() => navigate(`/match/${match.id}/rounds#round-${r.round}`)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <section className="py-12 text-center">
      {/* 巨型比分 */}
      <div className="flex items-center justify-center gap-5 md:gap-10">
        <div className="flex w-32 flex-col items-end gap-2 md:w-44">
          <span className="font-display text-2xl font-bold uppercase tracking-[0.06em] text-t-side md:text-3xl">
            {match.teamTName}
          </span>
          <SideBadge side="T" />
        </div>
        <div className="flex items-baseline gap-2 md:gap-3">
          {scoreCell(match.scoreT, tWon)}
          <span className="font-mono text-4xl font-bold text-ink-3 md:text-6xl">:</span>
          {scoreCell(match.scoreCT, ctWon)}
        </div>
        <div className="flex w-32 flex-col items-start gap-2 md:w-44">
          <span className="font-display text-2xl font-bold uppercase tracking-[0.06em] text-ct-side md:text-3xl">
            {match.teamCTName}
          </span>
          <SideBadge side="CT" />
        </div>
      </div>

      {/* meta 行 */}
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-ink-3">
        {match.displayMap} · {formatDate(match.playedAt)} · {formatDuration(match.durationSec)} ·
        MR12 · {match.roundsTotal} ROUNDS
      </p>

      {/* 半场分解条 */}
      <div className="mx-auto mt-8 max-w-xl space-y-3 pb-4">
        <HalfBar label="上半场" leftScore={h1.t} rightScore={h1.ct} />
        <HalfBar label="下半场" leftScore={h2TeamT} rightScore={h2TeamCT} swap />
        <p className="pt-1 text-xs text-ink-2">{conclusion}</p>
      </div>

      {/* 回合速览条（24 枚，12+12，整体一次淡入） */}
      <motion.div
        className="mx-auto mt-6 max-w-2xl space-y-2"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {roundRow("上半", firstHalf)}
        {roundRow("下半", secondHalf)}
      </motion.div>
    </section>
  );
}
