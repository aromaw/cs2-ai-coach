// V2 教练建议页（coach.md）：教练报告头 → 建议清单 → 本周训练清单，全页 2 处荧光笔。
// 删除 V1：分类过滤 pill 组、卡片包装、accordion、下一局目标卡、逐行 stagger。
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { motion } from "framer-motion";
import { useMatchData } from "@/lib/match-data";
import MatchHeader from "@/components/match/MatchHeader";
import SectionHeader from "@/components/board/SectionHeader";
import CrossMark from "@/components/board/CrossMark";
import CoachReport, { type CoachView } from "@/components/coach/CoachReport";
import AdviceList from "@/components/coach/AdviceList";
import TrainingPlan from "@/components/coach/TrainingPlan";
import {
  pickDefaultPlayer,
  sortAdvice,
  sortAdviceByEstimate,
  teamAdvice,
} from "@/components/player/utils";

type SortMode = "severity" | "impact";

function CoachSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-6 py-10 md:px-10">
      <div className="h-56 animate-pulse rounded-sm bg-board-2" />
      <div className="mx-auto mt-10 max-w-[880px] space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-sm bg-board-2" />
        ))}
      </div>
    </div>
  );
}

export default function Coach() {
  const { id } = useParams();
  const { data, isLoading, isFallback } = useMatchData(id);
  const [view, setView] = useState<CoachView>("player");
  const [sort, setSort] = useState<SortMode>("severity");

  const player = useMemo(
    () => (data ? pickDefaultPlayer(data.players) : undefined),
    [data],
  );

  const lists = useMemo(() => {
    if (!data || !player) return { personal: [], team: [] };
    const sorter = sort === "impact" ? sortAdviceByEstimate : sortAdvice;
    const personalRaw =
      view === "player"
        ? data.coach.filter((a) => a.player === player.name)
        : data.coach.filter((a) => !!a.player);
    return { personal: sorter(personalRaw), team: sorter(teamAdvice(data)) };
  }, [data, player, view, sort]);

  if (isLoading || !data || !player) return <CoachSkeleton />;

  const matchId = String(data.match.id);
  const scoped = [...lists.personal, ...lists.team];

  return (
    <div>
      <MatchHeader match={data.match} />

      {isFallback && (
        <p className="border-b border-line px-6 py-2 text-center text-xs text-warning">
          真实数据加载失败，当前展示内置示例对局。
        </p>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-[1360px] px-6 md:px-10"
      >
        {/* S1 教练报告头 COACH REPORT */}
        <CoachReport
          data={data}
          player={player}
          view={view}
          onViewChange={setView}
          advice={scoped}
        />

        {/* S2 建议清单 THE LIST */}
        <section className="border-t border-line py-10">
          <div className="mx-auto max-w-[880px]">
            <SectionHeader
              title="建议清单"
              en="THE LIST"
              action={
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  className="rounded-sm border border-line bg-board-3 px-2 py-1 font-mono text-xs text-ink-2 outline-none transition-colors duration-200 hover:border-line-strong"
                  aria-label="排序方式"
                >
                  <option value="severity">按严重度</option>
                  <option value="impact">按提升空间</option>
                </select>
              }
            />
            <AdviceList
              personal={lists.personal}
              team={lists.team}
              matchId={matchId}
              rounds={data.rounds}
            />
          </div>
        </section>

        {/* S3 本周训练清单 TRAINING PLAN（分区发丝线中点嵌准星） */}
        <div className="relative border-t border-line">
          <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-board-0 px-2">
            <CrossMark size={14} />
          </span>
        </div>
        <section className="py-10">
          <div className="mx-auto max-w-[880px]">
            <SectionHeader
              title="本周训练清单"
              en="TRAINING PLAN"
              note={`由上面 ${scoped.length} 条建议自动生成。勾掉一项，就少一个短板。`}
            />
            <TrainingPlan advice={scoped} matchId={matchId} />
          </div>
        </section>
      </motion.div>
    </div>
  );
}
