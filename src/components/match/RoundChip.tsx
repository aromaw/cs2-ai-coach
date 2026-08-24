// V2 RoundChip（design-v2 §7.5）：18×18 方角 chip，关键回合 = volt 角标小点
import { Bomb, Scissors, Skull, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoundSummary } from "@contracts/analysis";

const REASON_ICON = {
  bomb_exploded: Bomb,
  bomb_defused: Scissors,
  elimination: Skull,
  time: Timer,
  unknown: Skull,
} as const;

interface RoundChipProps {
  round: RoundSummary;
  /** 高亮视角阵营：该阵营获胜则实心亮色 */
  perspective?: "T" | "CT";
  active?: boolean;
  onClick?: () => void;
  /** 放大版 24×24（内嵌图标） */
  large?: boolean;
}

export default function RoundChip({ round, perspective, active, onClick, large }: RoundChipProps) {
  const Icon = REASON_ICON[round.winReason] ?? Skull;
  const won = perspective ? round.winner === perspective : true;
  const colorClass = !perspective
    ? round.winner === "T"
      ? "bg-t-side text-board-0"
      : "bg-ct-side text-board-0"
    : won
      ? perspective === "T"
        ? "bg-t-side text-board-0"
        : "bg-ct-side text-board-0"
      : "border border-line bg-board-2 text-ink-3";

  return (
    <div className="group relative inline-flex">
      <button
        onClick={onClick}
        className={cn(
          "relative flex items-center justify-center rounded-sm transition-colors duration-200",
          large ? "h-6 w-6" : "h-[18px] w-[18px]",
          colorClass,
          active && "ring-1 ring-volt",
        )}
      >
        {large && <Icon className="h-3 w-3" strokeWidth={2.5} />}
        {/* 关键回合：volt 角标小点 */}
        {round.isKeyRound && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-volt" />
        )}
      </button>
      <div className="pointer-events-none absolute bottom-7 left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-sm border border-line bg-board-3 px-2.5 py-1.5 font-mono text-[11px] text-ink-1 group-hover:block">
        R{round.round} · {round.scoreT}:{round.scoreCT} ·{" "}
        {round.winReason === "bomb_exploded"
          ? "爆破"
          : round.winReason === "bomb_defused"
            ? "拆弹"
            : round.winReason === "time"
              ? "时间耗尽"
              : "歼灭"}
        {round.durationSec ? ` · ${round.durationSec}s` : ""}
        {round.keyReason ? ` · ${round.keyReason}` : ""}
      </div>
    </div>
  );
}
