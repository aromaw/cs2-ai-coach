// V2 ScoreBoard（design-v2 §7.3）：开放式表格，发丝线行分隔，不套卡片
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import type { PlayerStat } from "@contracts/analysis";
import Mark from "@/components/board/Mark";

function ratingColor(r: number) {
  if (r >= 1.1) return "text-good";
  if (r < 0.9) return "text-bad";
  return "text-ink-1";
}

interface ScoreboardProps {
  players: PlayerStat[];
  matchId: string | number;
  highlight?: string;
  /** 全场 Rating 最高者的 Rating 外套荧光圈（overview 页特权） */
  markMvp?: boolean;
}

interface TeamBlockProps {
  team: PlayerStat[];
  side: "T" | "CT";
  matchId: string | number;
  highlight?: string;
  mvpName?: string;
}

function TeamBlock({ team, side, matchId, highlight, mvpName }: TeamBlockProps) {
  return (
    <div>
      <div className="flex items-center gap-3 border-t-2 border-line px-2 py-2.5">
        <span
          className={cn(
            "font-display text-sm font-bold uppercase tracking-[0.06em]",
            side === "T" ? "text-t-side" : "text-ct-side",
          )}
        >
          {team[0]?.teamName ?? (side === "T" ? "T 阵营" : "CT 阵营")}
        </span>
        <span className="font-mono text-xs text-ink-3">
          {side === "T" ? "T 开局" : "CT 开局"} · 合计{" "}
          {team.reduce((a, p) => a + p.kills, 0)} 击杀
        </span>
      </div>
      {team.map((p) => (
        <Link
          key={p.name}
          to={`/match/${matchId}/player/${encodeURIComponent(p.name)}`}
          className={cn(
            "group grid grid-cols-[minmax(120px,1.6fr)_repeat(9,minmax(0,1fr))] items-center gap-1 border-b border-line/60 px-2 transition-colors duration-200 hover:bg-board-2",
            "h-[46px]",
            highlight === p.name && "bg-volt-dim/50",
          )}
        >
          <span className="flex items-center gap-2 pl-2 text-sm font-medium text-ink-1">
            <span
              className={cn(
                "h-4 w-0.5 shrink-0",
                side === "T" ? "bg-t-side" : "bg-ct-side",
              )}
            />
            {p.name}
            {highlight === p.name && (
              <span className="rounded-sm border border-volt/50 px-1 font-mono text-[9px] text-volt">
                YOU
              </span>
            )}
            <span className="ml-auto hidden pr-1 text-xs text-volt opacity-0 transition-opacity duration-200 group-hover:inline group-hover:opacity-100">
              分析 →
            </span>
          </span>
          <Cell>{p.kills}</Cell>
          <Cell dim>{p.deaths}</Cell>
          <Cell dim>{p.assists}</Cell>
          <Cell>{p.kd.toFixed(2)}</Cell>
          <Cell>{p.adr.toFixed(1)}</Cell>
          <Cell>{p.kast.toFixed(0)}%</Cell>
          <Cell>{p.hsPercent.toFixed(0)}%</Cell>
          <Cell>{p.firstKills}</Cell>
          <Cell className={ratingColor(p.rating)}>
            <span className="relative inline-block px-1 py-0.5">
              {p.rating.toFixed(2)}
              {mvpName === p.name && <Mark type="circle" />}
            </span>
          </Cell>
        </Link>
      ))}
    </div>
  );
}

export default function Scoreboard({ players, matchId, highlight, markMvp }: ScoreboardProps) {
  const mvpName = markMvp
    ? [...players].sort((a, b) => b.rating - a.rating)[0]?.name
    : undefined;

  const tPlayers = [...players]
    .filter((p) => p.startSide === "T")
    .sort((a, b) => b.score - a.score);
  const ctPlayers = [...players]
    .filter((p) => p.startSide === "CT")
    .sort((a, b) => b.score - a.score);

  return (
    <div>
      <div className="grid grid-cols-[minmax(120px,1.6fr)_repeat(9,minmax(0,1fr))] gap-1 px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
        <span>选手</span>
        <span className="text-center">K</span>
        <span className="text-center">D</span>
        <span className="text-center">A</span>
        <span className="text-center">K/D</span>
        <span className="text-center">ADR</span>
        <span className="text-center">KAST</span>
        <span className="text-center">HS%</span>
        <span className="text-center">FK</span>
        <span className="text-center">RTG</span>
      </div>
      <TeamBlock team={tPlayers} side="T" matchId={matchId} highlight={highlight} mvpName={mvpName} />
      <TeamBlock team={ctPlayers} side="CT" matchId={matchId} highlight={highlight} mvpName={mvpName} />
    </div>
  );
}

function Cell({
  children,
  dim,
  className,
}: {
  children: React.ReactNode;
  dim?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-center font-mono text-sm tabular-nums",
        dim ? "text-ink-2" : "text-ink-1",
        className,
      )}
    >
      {children}
    </span>
  );
}
