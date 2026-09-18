// V2 选手分析页（player.md）：档案板 → 核心读数行 → 队内对比，全页 2 处荧光笔。
// 删除 V1：Rating 圆环、武器分布卡、对位击杀卡、建议速览卡、stagger 入场。
import { useParams, Link } from "react-router";
import { motion } from "framer-motion";
import { useMatchData } from "@/lib/match-data";
import { useHero } from "@/lib/hero";
import MatchHeader from "@/components/match/MatchHeader";
import SectionHeader from "@/components/board/SectionHeader";
import BigStat from "@/components/board/BigStat";
import Mark from "@/components/board/Mark";
import PlayerSwitcher from "@/components/player/PlayerSwitcher";
import ProfilePanel from "@/components/player/ProfilePanel";
import RadarPanel from "@/components/player/RadarPanel";
import TeamComparison from "@/components/player/TeamComparison";
import {
  adviceForPlayer,
  matchupCounts,
  resolvePlayer,
  useCountUp,
  weaponDistribution,
} from "@/components/player/utils";

function PlayerSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-6 py-10 md:px-10">
      <div className="h-12 animate-pulse rounded-sm bg-board-2" />
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="h-[340px] animate-pulse rounded-sm bg-board-2 lg:col-span-7" />
        <div className="h-[340px] animate-pulse rounded-sm bg-board-2 lg:col-span-5" />
      </div>
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-sm bg-board-2" />
        ))}
      </div>
    </div>
  );
}

/** HS% 短板读数：数值 warn 着色 + 手绘下划线（本页标记 2/2，仅在低于全场均值时出现） */
function ShortfallStat({ value, reference }: { value: number; reference: string }) {
  const { ref, display } = useCountUp(value, 900);
  return (
    <div className="px-5 py-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">HS%</p>
      <span ref={ref} className="relative mt-1.5 inline-block">
        <span className="font-mono text-5xl font-bold tabular-nums leading-none text-warning">
          {display.toFixed(1)}
        </span>
        <span className="ml-1 font-mono text-xl text-ink-3">%</span>
        <span className="absolute -bottom-2.5 left-[-6%] right-[-6%] h-3">
          <Mark type="underline" className="!inset-0" delay={0.8} />
        </span>
      </span>
      <p className="mt-3.5 text-xs text-ink-3">
        {reference}
        <span className="ml-1 text-danger">▼</span>
      </p>
    </div>
  );
}

export default function Player() {
  const { id, pid } = useParams();
  const { data, isLoading, isFallback } = useMatchData(id);
  const hero = useHero(data?.match.id, data?.players ?? []);

  if (isLoading || !data) return <PlayerSkeleton />;

  const { player, isDefault } = resolvePlayer(
    data.players,
    pid,
    hero.effective?.name,
  );
  if (!player) return <PlayerSkeleton />;

  const matchId = String(data.match.id);
  const team = data.players.filter((p) => p.teamName === player.teamName);
  const teamAdrAvg = team.reduce((s, p) => s + p.adr, 0) / Math.max(1, team.length);
  const allKastAvg =
    data.players.reduce((s, p) => s + p.kast, 0) / Math.max(1, data.players.length);
  const allHsAvg =
    data.players.reduce((s, p) => s + p.hsPercent, 0) / Math.max(1, data.players.length);
  const fkRank =
    [...data.players]
      .sort((a, b) => b.openingDuelWinRate - a.openingDuelWinRate)
      .findIndex((p) => p.name === player.name) + 1;
  const fkTotal = player.firstKills + player.firstDeaths;
  const hsShort = player.hsPercent < allHsAvg;

  // S2 小字行：残局 / 多杀 / 主武器 / 最大苦主
  const clutchRate =
    player.clutchAttempts > 0
      ? Math.round((player.clutchWins / player.clutchAttempts) * 100)
      : null;
  const multiPct = Math.round(
    (player.multiKillRounds / Math.max(1, data.match.roundsTotal)) * 100,
  );
  const topWeapon = weaponDistribution(player)[0];
  const topKilledBy = matchupCounts(data.rounds, player.name).killedBy[0];
  const footnote = [
    clutchRate !== null &&
      `残局 1vX ${clutchRate}%（${player.clutchWins}/${player.clutchAttempts}）`,
    `多杀回合 ${multiPct}%（${player.multiKillRounds}/${data.match.roundsTotal}）`,
    topWeapon && `击杀最多武器 ${topWeapon.label} ×${topWeapon.kills}`,
    topKilledBy && `被 ${topKilledBy.name} 击杀最多 ×${topKilledBy.count}`,
  ].filter(Boolean);

  const myAdviceCount = adviceForPlayer(data, player.name).length;

  return (
    <div>
      <MatchHeader match={data.match} players={data.players} />
      <PlayerSwitcher players={data.players} matchId={matchId} currentName={player.name} />

      {isFallback && (
        <p className="border-b border-line px-6 py-2 text-center text-xs text-warning">
          真实数据加载失败，当前展示内置示例对局。
        </p>
      )}

      {/* 切换玩家：0.3s 淡入更新，不重新 mount 布局 */}
      <motion.div
        key={player.name}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-[1360px] px-6 md:px-10"
      >
        {/* S1 选手档案板 PROFILE */}
        <section className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ProfilePanel data={data} player={player} isDefault={isDefault} />
          </div>
          <div className="lg:col-span-5">
            <RadarPanel player={player} players={data.players} />
          </div>
        </section>

        {/* S2 核心读数行 KEY NUMBERS */}
        <section className="border-t border-line py-10">
          <SectionHeader title="核心读数" en="KEY NUMBERS" />
          <div className="grid grid-cols-2 divide-x divide-line/60 md:grid-cols-4">
            <BigStat
              label="ADR"
              value={player.adr}
              reference={`全队平均 ${teamAdrAvg.toFixed(1)}`}
              trend={player.adr >= teamAdrAvg ? "up" : "down"}
            />
            <BigStat
              label="KAST"
              value={player.kast}
              suffix="%"
              reference={`全场平均 ${allKastAvg.toFixed(1)}%`}
              trend={player.kast >= allKastAvg ? "up" : "down"}
            />
            {hsShort ? (
              <ShortfallStat
                value={player.hsPercent}
                reference={`全场平均 ${allHsAvg.toFixed(1)}%`}
              />
            ) : (
              <BigStat
                label="HS%"
                value={player.hsPercent}
                suffix="%"
                reference={`全场平均 ${allHsAvg.toFixed(1)}%`}
                trend="up"
              />
            )}
            <BigStat
              label="首杀对枪胜率"
              value={player.openingDuelWinRate}
              suffix="%"
              reference={`${player.firstKills}/${fkTotal} · 全场第 ${fkRank}`}
              trend={player.openingDuelWinRate >= 50 ? "up" : "down"}
            />
          </div>
          <p className="mt-8 font-mono text-xs text-ink-3">{footnote.join(" · ")}</p>
        </section>

        {/* S3 队内对比 TEAM COMPARISON */}
        <section className="border-t border-line py-10">
          <SectionHeader title="队内对比" en="TEAM COMPARISON" />
          <TeamComparison player={player} players={data.players} isDefault={isDefault} />
          <div className="mt-10">
            <Link
              to={`/match/${matchId}/coach`}
              className="text-sm text-volt transition-colors duration-200 hover:text-volt-soft"
            >
              查看针对 TA 的 {myAdviceCount} 条教练建议 →
            </Link>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
