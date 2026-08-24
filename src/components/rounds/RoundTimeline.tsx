// V2 回合时间线（design-v2/rounds.md §S1）：两行磁带 + 内嵌回合详情面板
// 开放式分区，无卡片；整体淡入；关键回合 = chip 上 volt 角标（RoundChip 内置）
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import SectionHeader from "@/components/board/SectionHeader";
import { StaticUnderline } from "@/components/board/Mark";
import RoundChip from "@/components/match/RoundChip";
import RoundDetail from "./RoundDetail";
import type { RoundSummary } from "@contracts/analysis";

type Filter = "all" | "key";

interface RoundTimelineProps {
  rounds: RoundSummary[];
  teamT: string;
  teamCT: string;
  selected: number | null;
  onSelect: (round: number | null) => void;
  /** 全场最大经济转折点（详情内荧光笔下划线仅在该回合出现） */
  pivotRound: number | null;
}

function TapeRow({
  label,
  rounds,
  teamT,
  teamCT,
  selected,
  onSelect,
  pivotRound,
}: {
  label: string;
  rounds: RoundSummary[];
  teamT: string;
  teamCT: string;
  selected: number | null;
  onSelect: (r: number | null) => void;
  pivotRound: number | null;
}) {
  const selIdx = rounds.findIndex((r) => r.round === selected);
  return (
    <div className="flex items-start gap-4">
      <span className="w-20 shrink-0 pt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-x-2 gap-y-3">
          {rounds.map((r) => {
            const active = selected === r.round;
            return (
              <div key={r.round} className="flex w-9 flex-col items-center gap-1">
                <span className="font-mono text-[10px] tabular-nums text-ink-3">
                  {r.round}
                </span>
                <span
                  className={cn(
                    "rounded-sm transition-shadow duration-200",
                    active && "ring-1 ring-line-strong",
                  )}
                >
                  <RoundChip
                    round={r}
                    large
                    onClick={() => onSelect(active ? null : r.round)}
                  />
                </span>
                {/* 当前 chip 底部 2px volt 短线 / 否则占位 */}
                <span
                  className={cn(
                    "h-0.5 w-5 rounded-full transition-colors duration-200",
                    active ? "bg-volt" : "bg-transparent",
                  )}
                />
                {/* 比分快照：仅每 4 回合一个 */}
                <span className="h-3 font-mono text-[10px] tabular-nums text-ink-3">
                  {r.round % 4 === 0 ? `${r.scoreT}:${r.scoreCT}` : ""}
                </span>
              </div>
            );
          })}
        </div>
        {/* 展开态：chip 下方通栏详情（内嵌本行） */}
        <AnimatePresence initial={false}>
          {selIdx >= 0 && (
            <motion.div
              key={rounds[selIdx].round}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 border-y border-line py-5">
                <RoundDetail
                  round={rounds[selIdx]}
                  teamT={teamT}
                  teamCT={teamCT}
                  isPivot={pivotRound === rounds[selIdx].round}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function RoundTimeline({
  rounds,
  teamT,
  teamCT,
  selected,
  onSelect,
  pivotRound,
}: RoundTimelineProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const half = Math.ceil(rounds.length / 2);

  const shown = useMemo(
    () => (filter === "key" ? rounds.filter((r) => r.isKeyRound) : rounds),
    [rounds, filter],
  );
  const firstHalf = shown.filter((r) => r.round <= half);
  const secondHalf = shown.filter((r) => r.round > half);

  return (
    <section>
      <SectionHeader
        title="回合时间线"
        en="ROUND TIMELINE"
        action={
          <div className="flex items-center gap-4">
            {(
              [
                ["all", "全部"],
                ["key", "仅关键回合"],
              ] as [Filter, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={cn(
                  "relative font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-200",
                  filter === v ? "text-ink-1" : "text-ink-3 hover:text-ink-2",
                )}
              >
                {label}
                {filter === v && <StaticUnderline />}
              </button>
            ))}
          </div>
        }
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <TapeRow
          label={`上半 · ${teamT} T开`}
          rounds={firstHalf}
          teamT={teamT}
          teamCT={teamCT}
          selected={selected}
          onSelect={onSelect}
          pivotRound={pivotRound}
        />
        <TapeRow
          label={`下半 · ${teamCT} T开`}
          rounds={secondHalf}
          teamT={teamT}
          teamCT={teamCT}
          selected={selected}
          onSelect={onSelect}
          pivotRound={pivotRound}
        />
      </motion.div>
    </section>
  );
}
