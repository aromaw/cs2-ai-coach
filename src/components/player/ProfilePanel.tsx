// V2 选手档案板（player.md §1 左 7 列）：HudFrame 角框内的档案 + 巨型 Rating。
// 签名元素：巨型 mono Rating 外套手绘圈（本页标记 1/2），count-up 0.9s。
import type { AnalysisResult, PlayerStat } from "@contracts/analysis";
import HudFrame from "@/components/board/HudFrame";
import Mark from "@/components/board/Mark";
import CoachNote from "@/components/board/CoachNote";
import { avatarFor, radarScores, radarVerdict, roleOf, useCountUp } from "./utils";

interface ProfilePanelProps {
  data: AnalysisResult;
  player: PlayerStat;
  isDefault: boolean;
}

export default function ProfilePanel({ data, player, isDefault }: ProfilePanelProps) {
  const rank =
    [...data.players].sort((a, b) => b.rating - a.rating).findIndex((p) => p.name === player.name) + 1;
  const kdDiff = player.kills - player.deaths;
  const { ref, display } = useCountUp(player.rating, 900);

  return (
    <HudFrame className="p-8">
      {/* 上排：头像 + 名字 + YOU */}
      <div className="flex items-center gap-5">
        <img
          src={avatarFor(player.name)}
          alt={player.name}
          className="h-[72px] w-[72px] rounded border border-line-strong object-cover"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink-1">
              {player.name}
            </h1>
            {isDefault && (
              <span className="rounded-sm border border-volt/50 px-1 py-0.5 font-mono text-[9px] font-bold tracking-widest text-volt">
                YOU
              </span>
            )}
          </div>
          <p className="mt-2 font-mono text-[11px] text-ink-3">
            {player.teamName} · {player.startSide} 开局 · {roleOf(player, data.players)} ·{" "}
            {data.match.roundsTotal} 回合
          </p>
        </div>
      </div>

      {/* 巨型 Rating + K/D/A 裸读数 */}
      <div className="mt-6 flex flex-wrap items-end gap-10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
            Rating 2.0 · 全场第 {rank}
          </p>
          <span ref={ref} className="relative mt-1 inline-block">
            <span className="font-mono text-7xl font-bold leading-none tracking-tight tabular-nums text-ink-1">
              {display.toFixed(2)}
            </span>
            <Mark type="circle" delay={0.5} />
          </span>
        </div>
        <div className="pb-1">
          <p className="font-mono text-xl tabular-nums text-ink-1">
            <span className="text-[10px] uppercase tracking-[0.22em] text-ink-3">K/D/A </span>
            {player.kills} / {player.deaths} / {player.assists}
          </p>
          <p className="mt-1.5 font-mono text-xl tabular-nums">
            <span className="text-[10px] uppercase tracking-[0.22em] text-ink-3">K-D </span>
            <span className={kdDiff >= 0 ? "text-success" : "text-danger"}>
              {kdDiff >= 0 ? "+" : ""}
              {kdDiff}
            </span>
          </p>
        </div>
      </div>

      {/* 画像判语便签 */}
      <CoachNote className="mt-6 max-w-sm [&>div]:!text-lg md:[&>div]:!text-xl">
        {radarVerdict(radarScores(player))}
      </CoachNote>
    </HudFrame>
  );
}
