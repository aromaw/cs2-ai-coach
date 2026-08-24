// V2 回合经济页（design-v2/rounds.md）：3 分区 — 回合时间线 / 经济曲线 / 决策审计
import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import MatchHeader from "@/components/match/MatchHeader";
import RoundTimeline from "@/components/rounds/RoundTimeline";
import EconomyChart, { type PivotInfo } from "@/components/rounds/EconomyChart";
import EconAudit from "@/components/rounds/EconAudit";
import { deriveEconAudit } from "@/components/rounds/econ-utils";
import { useMatchData } from "@/lib/match-data";

function RoundsSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-6 py-10 md:px-10">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="mt-6 h-28 w-full" />
      <Skeleton className="mt-4 h-28 w-full" />
      <div className="mt-12 border-t border-line pt-10">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-6 h-[280px] w-full" />
      </div>
    </div>
  );
}

export default function Rounds() {
  const { id } = useParams();
  const { data, isLoading, isFallback } = useMatchData(id);
  const [selected, setSelected] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const auditItems = useMemo(
    () =>
      data ? deriveEconAudit(data.rounds, data.match.teamTName, data.match.teamCTName) : [],
    [data],
  );

  // 全场最大经济转折点 = 正向金额影响最大的审计条目（mock 中为 R14 强起）
  const pivot = useMemo<PivotInfo | null>(() => {
    if (!auditItems.length) return null;
    const best = [...auditItems].sort((a, b) => b.impact - a.impact)[0];
    return best.impact > 0
      ? { round: best.round, impact: best.impact, buyType: best.buyType }
      : null;
  }, [auditItems]);

  if (isLoading || !data) return <RoundsSkeleton />;

  const jumpToRound = (round: number) => {
    setSelected(round);
    timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <MatchHeader match={data.match} />
      <div className="mx-auto max-w-[1360px] px-6 md:px-10">
        {isFallback && (
          <p className="mt-6 font-mono text-[11px] text-warn">
            ※ 真实数据加载失败，当前展示内置示例对局。
          </p>
        )}

        {/* S1 回合时间线 */}
        <div ref={timelineRef} className="scroll-mt-32 py-10 md:py-14">
          <RoundTimeline
            rounds={data.rounds}
            teamT={data.match.teamTName}
            teamCT={data.match.teamCTName}
            selected={selected}
            onSelect={setSelected}
            pivotRound={pivot?.round ?? null}
          />
        </div>

        {/* S2 经济曲线 */}
        <div className="border-t border-line py-10 md:py-14">
          <EconomyChart data={data} pivot={pivot} />
        </div>

        {/* S3 经济决策审计 */}
        <div className="border-t border-line py-10 md:py-14">
          <EconAudit
            items={auditItems}
            rounds={data.rounds}
            teamT={data.match.teamTName}
            teamCT={data.match.teamCTName}
            onJump={jumpToRound}
          />
        </div>
      </div>
    </div>
  );
}
