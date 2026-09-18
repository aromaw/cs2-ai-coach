// V2 坏习惯证据列表：按问题类型分组、支持按玩家筛选。
// 每条证据来自真实回合事件（首死/补枪/闪光/经济/下包后），可核对到回合与时间。
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { EvidenceItem, PlayerStat, RoundSummary } from "@contracts/analysis";
import RoundChip from "@/components/match/RoundChip";

const SEVERITY_META: Record<
  EvidenceItem["severity"],
  { dot: string; text: string; order: number }
> = {
  high: { dot: "bg-danger", text: "text-danger", order: 0 },
  mid: { dot: "bg-warning", text: "text-warning", order: 1 },
  low: { dot: "bg-ink-3", text: "text-ink-3", order: 2 },
};

function fmtTime(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface EvidenceListProps {
  evidence: EvidenceItem[];
  players: PlayerStat[];
  rounds: RoundSummary[];
}

export default function EvidenceList({
  evidence,
  players,
  rounds,
}: EvidenceListProps) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(
    () =>
      filter === "all"
        ? evidence
        : evidence.filter((e) => e.playerId === filter),
    [evidence, filter],
  );

  const groups = useMemo(() => {
    const m = new Map<string, EvidenceItem[]>();
    for (const e of filtered) {
      const list = m.get(e.issue) ?? [];
      list.push(e);
      m.set(e.issue, list);
    }
    return [...m.entries()].sort((a, b) => {
      const sev = (items: EvidenceItem[]) =>
        Math.min(...items.map((i) => SEVERITY_META[i.severity].order));
      return sev(a[1]) - sev(b[1]) || b[1].length - a[1].length;
    });
  }, [filtered]);

  if (evidence.length === 0) {
    return (
      <p className="py-8 text-sm text-ink-3">
        本场没有检测到高置信度的坏习惯证据（解析数据不足时无法生成，例如老版本
        demo 未录制击杀归属）。
      </p>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-2 flex items-center justify-end gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
          按选手筛选
        </span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-sm border border-line bg-board-3 px-2 py-1 font-mono text-xs text-ink-1 outline-none transition-colors duration-200 hover:border-line-strong"
          aria-label="按选手筛选证据"
        >
          <option value="all">全部（{evidence.length}）</option>
          {players.map((p) => {
            const n = evidence.filter((e) => e.playerId === p.steamid).length;
            if (!n) return null;
            return (
              <option key={p.steamid} value={p.steamid}>
                {p.name}（{n}）
              </option>
            );
          })}
        </select>
      </div>

      {groups.map(([issue, items]) => {
        const meta = SEVERITY_META[items[0].severity];
        return (
          <div key={issue} className="border-b border-line/60 py-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
              <h3 className="font-display text-sm font-semibold text-ink-1">
                {items[0].label}
              </h3>
              <span className={cn("font-mono text-[10px]", meta.text)}>
                ×{items.length}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {items.map((e) => {
                const round = rounds.find((r) => r.round === e.round);
                return (
                  <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                    {round ? (
                      <RoundChip round={round} />
                    ) : (
                      <span className="font-mono text-[11px] text-ink-3">
                        R{e.round}
                      </span>
                    )}
                    <span className="font-mono text-[11px] tabular-nums text-ink-3">
                      {fmtTime(e.t)}
                    </span>
                    <span className="font-mono text-[11px] text-ink-3">
                      {e.location}
                    </span>
                    <span className="min-w-[120px] font-medium text-ink-1">
                      {e.playerName}
                    </span>
                    <span className="flex-1 basis-64 text-ink-2">{e.description}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </motion.div>
  );
}
