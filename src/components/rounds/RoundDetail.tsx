// V2 回合详情（design-v2/rounds.md §S1 展开面板）：
// 左栏 回合剧本（事件流） / 右栏 经济与判定（装备价值条 + 购买徽章 + 系统判定）
import { motion } from "framer-motion";
import { Bomb, Crosshair, Scissors, Skull, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import Mark from "@/components/board/Mark";
import { BUY_LABEL, roundVerdict, sideName, type Verdict } from "./econ-utils";
import type { BuyType, RoundEvent, RoundSummary } from "@contracts/analysis";

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const REASON_TEXT = {
  bomb_exploded: "炸弹引爆",
  bomb_defused: "炸弹被拆除",
  elimination: "全歼对手",
  time: "时间耗尽",
  unknown: "回合结束",
} as const;

const BUY_BADGE: Record<BuyType, string> = {
  full_buy: "border-good/40 text-good",
  force: "border-t-side/40 text-t-side",
  semi: "border-warn/40 text-warn",
  full_eco: "border-line-strong text-ink-3",
  unknown: "border-line-strong text-ink-3",
};

const VERDICT_COLOR: Record<Verdict, string> = {
  good: "text-good",
  bad: "text-bad",
  neutral: "text-warn",
};

function eventText(e: RoundEvent): string {
  switch (e.type) {
    case "kill":
      return `${e.actor ?? "?"} 击杀 ${e.victim ?? "?"}${e.weapon ? ` · ${e.weapon}` : ""}${e.headshot ? " · 爆头" : ""}`;
    case "plant":
      return `${e.actor ?? "T 方"} 安放炸弹`;
    case "defuse":
      return `${e.actor ?? "CT 方"} 拆除炸弹`;
    case "explode":
      return "炸弹引爆";
    case "flash":
      return `${e.actor ?? "?"} 投掷闪光弹`;
    case "smoke":
      return `${e.actor ?? "?"} 投掷烟雾弹`;
    case "molotov":
      return `${e.actor ?? "?"} 投掷燃烧弹`;
    case "he":
      return `${e.actor ?? "?"} 投掷手雷`;
    default:
      return "事件";
  }
}

function EventIcon({ e }: { e: RoundEvent }) {
  const cls = "h-3 w-3";
  switch (e.type) {
    case "kill":
      return e.headshot ? (
        <Crosshair className={cn(cls, "text-bad")} />
      ) : (
        <Skull className={cn(cls, "text-ink-2")} />
      );
    case "plant":
    case "explode":
      return <Bomb className={cn(cls, "text-t-side")} />;
    case "defuse":
      return <Scissors className={cn(cls, "text-ct-side")} />;
    default:
      return <Zap className={cn(cls, "text-warn")} />;
  }
}

/** 判定行：pivot 回合时 emphasis 数字外套荧光笔下划线 */
function VerdictLine({
  verdict,
  text,
  emphasis,
  mark,
}: {
  verdict: Verdict;
  text: string;
  emphasis?: string;
  mark: boolean;
}) {
  if (mark && emphasis && text.includes(emphasis)) {
    const [before, after] = text.split(emphasis);
    return (
      <p className={cn("text-sm", VERDICT_COLOR[verdict])}>
        {before}
        <span className="relative inline-block px-0.5">
          {emphasis}
          <Mark type="underline" delay={0.6} />
        </span>
        {after}
      </p>
    );
  }
  return <p className={cn("text-sm", VERDICT_COLOR[verdict])}>{text}</p>;
}

function EquipBar({
  team,
  value,
  max,
  side,
  buy,
}: {
  team: string;
  value: number;
  max: number;
  side: "T" | "CT";
  buy: BuyType;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-mono text-[11px] uppercase tracking-wider",
            side === "T" ? "text-t-side" : "text-ct-side",
          )}
        >
          {team}
        </span>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase",
              BUY_BADGE[buy],
            )}
          >
            {BUY_LABEL[buy]}
          </span>
          <span className="font-mono text-xs tabular-nums text-ink-1">{fmt$(value)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full bg-board-2">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: `${Math.max(3, (value / max) * 100)}%`, transformOrigin: "left" }}
          className={cn("h-full", side === "T" ? "bg-t-side/80" : "bg-ct-side/80")}
        />
      </div>
    </div>
  );
}

interface RoundDetailProps {
  round: RoundSummary;
  teamT: string;
  teamCT: string;
  /** 是否全场最大经济转折点（荧光笔下划线唯一出现处） */
  isPivot?: boolean;
}

export default function RoundDetail({ round, teamT, teamCT, isPivot }: RoundDetailProps) {
  const winnerName = sideName(round.winner, teamT, teamCT);
  const verdict = roundVerdict(round, teamT, teamCT);
  const maxEquip = Math.max(round.equipValueT, round.equipValueCT, 1);

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {/* 左栏 · 回合剧本 */}
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-base font-semibold uppercase tracking-[0.06em] text-ink-1">
            ROUND {round.round}
          </span>
          <span
            className={cn(
              "font-display text-base font-semibold uppercase",
              round.winner === "T" ? "text-t-side" : "text-ct-side",
            )}
          >
            {winnerName} 胜
          </span>
          {round.isKeyRound && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-volt">
              KEY · {round.keyReason ?? "关键回合"}
            </span>
          )}
        </div>
        <p className="mt-1 font-mono text-[11px] tabular-nums text-ink-3">
          {REASON_TEXT[round.winReason]} · 时长 {fmtTime(round.durationSec)} · 结束比分{" "}
          {round.scoreT}:{round.scoreCT}
        </p>
        {/* 事件流：1px 竖线串联，圆点依次点亮（stagger 上限 0.4s） */}
        <div className="mt-4 max-h-60 space-y-0 overflow-y-auto pr-1">
          {round.events.map((e, i) => (
            <div key={i} className="relative flex items-center gap-2.5 border-l border-line py-1.5 pl-3">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(0.1 + i * 0.08, 0.5), duration: 0.2 }}
                className="absolute -left-[3.5px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-board-3 ring-1 ring-line-strong"
              />
              <span className="w-9 shrink-0 font-mono text-[11px] tabular-nums text-ink-3">
                {fmtTime(e.t)}
              </span>
              <EventIcon e={e} />
              <span className="text-sm text-ink-2">{eventText(e)}</span>
            </div>
          ))}
          {round.events.length === 0 && (
            <p className="py-2 text-sm text-ink-3">本回合无记录事件。</p>
          )}
        </div>
      </div>

      {/* 右栏 · 经济与判定 */}
      <div className="flex flex-col gap-5 md:border-l md:border-line/60 md:pl-8">
        <EquipBar team={teamT} value={round.equipValueT} max={maxEquip} side="T" buy={round.buyTypeT} />
        <EquipBar team={teamCT} value={round.equipValueCT} max={maxEquip} side="CT" buy={round.buyTypeCT} />
        <div className="border-t border-line/60 pt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
            系统判定
          </p>
          <VerdictLine
            verdict={verdict.verdict}
            text={verdict.text}
            emphasis={verdict.emphasis}
            mark={!!isPivot}
          />
        </div>
      </div>
    </div>
  );
}
