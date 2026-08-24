// V2 战术热力页（design-v2/tactics.md）：2 分区 — 地图舞台+读数面板 / 道具行
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import MatchHeader from "@/components/match/MatchHeader";
import CrossMark from "@/components/board/CrossMark";
import HeatmapStage from "@/components/tactics/HeatmapStage";
import type { LayerMode, SideMode } from "@/components/tactics/HeatmapStage";
import ReadoutPanel from "@/components/tactics/ReadoutPanel";
import type { PlayerScope } from "@/components/tactics/ReadoutPanel";
import UtilityRow from "@/components/tactics/UtilityRow";
import { useMatchData } from "@/lib/match-data";

function TacticsSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-6 py-10 md:px-10">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="mx-auto mt-6 aspect-square max-w-[600px]" />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function Tactics() {
  const { id } = useParams();
  const { data, isLoading, isFallback } = useMatchData(id);

  const [mode, setMode] = useState<LayerMode>("death");
  const [side, setSide] = useState<SideMode>("all");
  const [scope, setScope] = useState<PlayerScope>("all");
  const [range, setRange] = useState<[number, number]>([1, 24]);
  const roundsTotal = data?.match.roundsTotal ?? 24;

  // 数据到达后同步滑杆到全程（roundsTotal 仅在加载完成时变化一次）
  useEffect(() => {
    setRange([1, roundsTotal]);
  }, [roundsTotal]);

  // 主角玩家（"你"）：设计约定 s1mple丶Fan，缺失时取评分最高者
  const hero = useMemo(() => {
    if (!data) return { name: "", side: "T" as const };
    const byName = data.players.find((p) => p.name === "s1mple丶Fan");
    const h =
      byName ?? [...data.players].sort((a, b) => b.rating - a.rating)[0];
    return { name: h?.name ?? "", side: h?.startSide ?? ("T" as const) };
  }, [data]);

  // 按读数面板 scope 过滤点位（我方 = 与"你"同阵营）
  const scopedHeat = useMemo(() => {
    if (!data) return [];
    if (scope === "all") return data.heat;
    if (scope === "you") return data.heat.filter((p) => p.player === hero.name);
    if (scope === "ours") return data.heat.filter((p) => p.side === hero.side);
    return data.heat.filter((p) => p.side && p.side !== hero.side);
  }, [data, scope, hero]);

  if (isLoading || !data) return <TacticsSkeleton />;

  return (
    <div>
      <MatchHeader match={data.match} />
      <div className="mx-auto max-w-[1360px] px-6 md:px-10">
        {isFallback && (
          <p className="mt-6 font-mono text-[11px] text-warn">
            ※ 真实数据加载失败，当前展示内置示例对局。
          </p>
        )}

        {/* S1 地图舞台（左 8）+ 读数面板（右 4） */}
        <div className="grid grid-cols-1 gap-10 py-10 md:py-14 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <HeatmapStage
              mapName={data.match.mapName}
              displayMap={data.match.displayMap}
              points={scopedHeat}
              roundsTotal={roundsTotal}
              mode={mode}
              onModeChange={setMode}
              side={side}
              onSideChange={setSide}
              range={range}
              onRangeChange={setRange}
            />
          </div>
          <div className="lg:col-span-4">
            <ReadoutPanel
              scope={scope}
              onScopeChange={setScope}
              points={scopedHeat}
              mode={mode}
              side={side}
              range={range}
              heroName={hero.name}
              teamT={data.match.teamTName}
              teamCT={data.match.teamCTName}
            />
          </div>
        </div>

        {/* S2 道具行：通栏发丝线，线中点嵌准星 */}
        <div className="relative border-t border-line py-10 md:py-14">
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-board-0 px-2">
            <CrossMark size={14} />
          </span>
          <UtilityRow
            utility={data.utility}
            players={data.players}
            roundsTotal={roundsTotal}
            teamT={data.match.teamTName}
          />
        </div>
      </div>
    </div>
  );
}
