// V2 MatchHeader（design-v2 §7.2）：单行巨型 mono 比分 + 静态手绘下划线 tab
import { Link, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import type { MatchInfo, PlayerStat } from "@contracts/analysis";
import SideBadge from "./SideBadge";
import { StaticUnderline } from "@/components/board/Mark";
import { useHero } from "@/lib/hero";

const TABS = [
  { label: "总览", en: "OVERVIEW", path: "" },
  { label: "选手", en: "PLAYER", path: "/player/me" },
  { label: "回合经济", en: "ROUNDS", path: "/rounds" },
  { label: "战术热力", en: "TACTICS", path: "/tactics" },
  { label: "教练建议", en: "COACH", path: "/coach" },
];

export default function MatchHeader({
  match,
  players,
}: {
  match: MatchInfo;
  players?: PlayerStat[];
}) {
  const loc = useLocation();
  const base = `/match/${match.id}`;
  const current = loc.pathname;
  const hero = useHero(match.id, players ?? []);

  const tWon = match.scoreT > match.scoreCT;
  const ctWon = match.scoreCT > match.scoreT;
  const mins = Math.floor(match.durationSec / 60);
  const secs = String(match.durationSec % 60).padStart(2, "0");

  return (
    <div className="sticky top-14 z-40 border-b border-line bg-board-0/90 backdrop-blur-md">
      <div className="mx-auto max-w-[1360px] px-6 md:px-10">
        {/* 单行：地图 → 比分 → 队名 → meta */}
        <div className="flex h-16 items-center gap-4 overflow-hidden">
          <span className="font-display text-lg font-bold uppercase tracking-[0.06em] text-ink-1">
            {match.displayMap}
          </span>
          <div className="flex items-baseline gap-2 font-mono font-bold tabular-nums">
            <span className={cn("text-3xl", tWon ? "text-volt" : "text-ink-2")}>
              {match.scoreT}
            </span>
            <span className="text-xl text-ink-3">:</span>
            <span className={cn("text-3xl", ctWon ? "text-volt" : "text-ink-2")}>
              {match.scoreCT}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SideBadge side="T" />
            <span className="font-display text-sm font-semibold uppercase text-t-side">
              {match.teamTName}
            </span>
            <span className="font-mono text-[10px] text-ink-3">VS</span>
            <SideBadge side="CT" />
            <span className="font-display text-sm font-semibold uppercase text-ct-side">
              {match.teamCTName}
            </span>
          </div>
          <div className="ml-auto hidden font-mono text-[11px] text-ink-3 sm:block">
            {new Date(match.playedAt).toLocaleDateString("zh-CN")} · {mins}:{secs} · MR12
            {match.source === "demo" && " · 示例对局"}
          </div>
        </div>
        {/* Tab 行（右侧："你是谁"选择器） */}
        <nav className="flex h-10 gap-1 border-t border-line/60">
          {players && players.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
                你
              </span>
              <select
                value={hero.heroName}
                onChange={(e) => hero.select(e.target.value)}
                className={cn(
                  "max-w-[160px] rounded-sm border bg-board-3 px-1.5 py-0.5 font-mono text-[11px] outline-none transition-colors duration-200 hover:border-line-strong",
                  hero.isAuto ? "border-warning/60 text-warning" : "border-line text-ink-1",
                )}
                aria-label="选择你的 ID"
              >
                <option value="">自动（未指定）</option>
                {players.map((p) => (
                  <option key={p.steamid} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {TABS.map((tab) => {
            const to = `${base}${tab.path}`;
            const isActive =
              tab.path === ""
                ? current === base || current === `${base}/`
                : tab.path.startsWith("/player")
                  ? current.includes("/player/")
                  : current.startsWith(`${base}${tab.path}`);
            return (
              <Link
                key={tab.path}
                to={to}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-200",
                  isActive ? "text-ink-1" : "text-ink-3 hover:text-ink-2",
                )}
              >
                {tab.label}
                <span className="hidden text-[9px] text-ink-3/70 lg:inline">{tab.en}</span>
                {isActive && <StaticUnderline className="-bottom-[1px]" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
