// V2 比赛总览 /match/:id — 战术指挥室风（design-v2 overview.md）
// 三分区：S1 赛果板（巨型比分）→ S2 记分板（共享 Scoreboard，MVP 荧光圈）→ S3 团队对比
import { useMemo } from "react";
import { useParams } from "react-router";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import MatchHeader from "@/components/match/MatchHeader";
import Scoreboard from "@/components/match/Scoreboard";
import SectionHeader from "@/components/board/SectionHeader";
import CrossMark from "@/components/board/CrossMark";
import CoachNote from "@/components/board/CoachNote";
import ScorePanel from "@/components/overview/ScorePanel";
import TeamCompare from "@/components/overview/TeamCompare";
import { teamAgg } from "@/components/overview/derive";
import { useMatchData } from "@/lib/match-data";

/** 通栏发丝线分隔；页面级大分区之间可在线中点压一枚准星（一页 ≤2 个） */
function SectionDivider({ cross = false }: { cross?: boolean }) {
  if (!cross) return <div className="border-t border-line" aria-hidden />;
  return (
    <div className="relative border-t border-line" aria-hidden>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-board-0 px-2">
        <CrossMark size={14} />
      </span>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div>
      {/* MatchHeader 骨架 */}
      <div className="border-b border-line">
        <div className="mx-auto max-w-[1360px] px-6 md:px-10">
          <div className="flex h-16 items-center gap-4">
            <Skeleton className="h-5 w-20 rounded-sm bg-board-2" />
            <Skeleton className="h-8 w-32 rounded-sm bg-board-2" />
            <Skeleton className="h-4 w-48 rounded-sm bg-board-2" />
            <Skeleton className="ml-auto hidden h-3 w-40 rounded-sm bg-board-2 sm:block" />
          </div>
          <div className="flex h-10 gap-2 border-t border-line/60 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-16 rounded-sm bg-board-2" />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] px-6 md:px-10">
        {/* S1 赛果板骨架 */}
        <div className="flex flex-col items-center py-12">
          <Skeleton className="h-20 w-[420px] max-w-full rounded-sm bg-board-2 md:h-24" />
          <Skeleton className="mt-4 h-3 w-64 rounded-sm bg-board-2" />
          <div className="mx-auto mt-8 w-full max-w-xl space-y-3">
            <Skeleton className="h-1.5 w-full rounded-sm bg-board-2" />
            <Skeleton className="h-1.5 w-full rounded-sm bg-board-2" />
          </div>
          <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-1.5">
            {Array.from({ length: 24 }).map((_, i) => (
              <Skeleton key={i} className="h-[18px] w-[18px] rounded-sm bg-board-2" />
            ))}
          </div>
        </div>

        <div className="border-t border-line" />

        {/* S2 记分板骨架 */}
        <div className="py-10 md:py-14">
          <Skeleton className="h-5 w-40 rounded-sm bg-board-2" />
          <div className="mt-6 space-y-px">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-[46px] w-full rounded-sm bg-board-2/70" />
            ))}
          </div>
        </div>

        <div className="border-t border-line" />

        {/* S3 团队对比骨架 */}
        <div className="py-10 md:py-14">
          <Skeleton className="h-5 w-48 rounded-sm bg-board-2" />
          <div className="mx-auto mt-6 max-w-3xl space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded-sm bg-board-2" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Overview() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isFallback } = useMatchData(id);

  // 主角玩家（"你"）：设计约定为 s1mple丶Fan，缺失时取 Rating 最高者
  const heroName = useMemo(() => {
    if (!data) return undefined;
    const byName = data.players.find((p) => p.name === "s1mple丶Fan");
    if (byName) return byName.name;
    return [...data.players].sort((a, b) => b.rating - a.rating)[0]?.name;
  }, [data]);

  if (isLoading || !data) return <OverviewSkeleton />;

  const tAgg = teamAgg(data.players, "T");
  const ctAgg = teamAgg(data.players, "CT");
  const flashLeader =
    tAgg.flashAssists >= ctAgg.flashAssists ? data.match.teamTName : data.match.teamCTName;

  return (
    <div>
      <MatchHeader match={data.match} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-[1360px] px-6 md:px-10"
      >
        {isFallback && (
          <p className="mt-4 border-l-2 border-warning/60 bg-warning/10 px-4 py-2 text-xs text-warning">
            真实解析数据加载失败，当前展示内置示例对局。
          </p>
        )}

        {/* S1 赛果板（荧光笔标记 1/2：胜方比分圆圈在 ScorePanel 内） */}
        <ScorePanel data={data} />

        <SectionDivider cross />

        {/* S2 记分板（荧光笔标记 2/2：MVP Rating 圆圈，由 markMvp 开启） */}
        <section className="py-10 md:py-14">
          <SectionHeader
            title="记分板"
            en="SCOREBOARD"
            note="两队分组，按贡献分排序；荧光圈 = 全场 MVP。"
          />
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <Scoreboard
              players={data.players}
              matchId={id ?? data.match.id}
              highlight={heroName}
              markMvp
            />
          </motion.div>
        </section>

        <SectionDivider />

        {/* S3 团队对比 */}
        <section className="py-10 md:py-14">
          <SectionHeader title="团队对比" en="TEAM VS TEAM" />
          <TeamCompare data={data} />
          <CoachNote className="mx-auto mt-8 max-w-md">
            {`→ 闪光助攻 ${tAgg.flashAssists}:${ctAgg.flashAssists}，${flashLeader} 的道具配合更到位。`}
          </CoachNote>
        </section>
      </motion.div>
    </div>
  );
}
