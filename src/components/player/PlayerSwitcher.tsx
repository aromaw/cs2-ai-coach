// V2 玩家切换条（player.md §0）：纯文字 chip，按队伍分组，组间竖发丝线 + 队名标签。
// 选中态 = ink-1 文字 + volt 静态手绘下划线；删除 V1 的头像与 layoutId 滑动底线。
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import type { PlayerStat } from "@contracts/analysis";
import { StaticUnderline } from "@/components/board/Mark";

interface PlayerSwitcherProps {
  players: PlayerStat[];
  matchId: string;
  currentName: string;
}

export default function PlayerSwitcher({ players, matchId, currentName }: PlayerSwitcherProps) {
  const teams = [...new Set(players.map((p) => p.teamName))];

  return (
    <div className="border-b border-line">
      <div className="mx-auto max-w-[1360px] px-6 md:px-10">
        <div className="flex h-12 items-center gap-5 overflow-x-auto">
          {teams.map((team, ti) => {
            const members = players
              .filter((p) => p.teamName === team)
              .sort((a, b) => b.rating - a.rating);
            const side = members[0]?.startSide;
            return (
              <div key={team} className="flex items-center gap-4">
                {ti > 0 && <span className="h-5 w-px shrink-0 bg-line" aria-hidden />}
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.22em]",
                    side === "T" ? "text-t-side" : "text-ct-side",
                  )}
                >
                  {team}
                </span>
                <div className="flex items-center gap-1">
                  {members.map((p) => {
                    const active = p.name === currentName;
                    return (
                      <Link
                        key={p.name}
                        to={`/match/${matchId}/player/${encodeURIComponent(p.name)}`}
                        className={cn(
                          "relative flex shrink-0 items-baseline gap-1.5 px-2 py-1 transition-colors duration-200",
                          active ? "text-ink-1" : "text-ink-3 hover:text-ink-2",
                        )}
                      >
                        <span className="font-mono text-xs">{p.name}</span>
                        <span className="font-mono text-[10px] tabular-nums text-ink-3">
                          {p.rating.toFixed(2)}
                        </span>
                        {active && <StaticUnderline className="-bottom-0.5" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
