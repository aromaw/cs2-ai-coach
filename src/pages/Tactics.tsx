// V2 战术热力页（design-v2/tactics.md）：2 分区 — 地图舞台+读数面板 / 道具行
import { useMemo, useState } from "react";
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
import { useHero } from "@/lib/hero";

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
  const [selectedRange, setSelectedRange] = useState<[number, number]>([
    1,
    Number.MAX_SAFE_INTEGER,
  ]);
  const roundsTotal = data?.match.roundsTotal ?? 24;
  const range = useMemo<[number, number]>(
    () => [Math.max(1, selectedRange[0]), Math.min(roundsTotal, selectedRange[1])],
    [roundsTotal, selectedRange],
  );

  // 主角玩家（"你"）：由上传者在头部选择器指定，未选择时回退评分最高者
  const heroState = useHero(data?.match.id, data?.players ?? []);
  const hero = useMemo(
    () => ({
      name: heroState.effective?.name ?? "",
      side: heroState.effective?.startSide ?? ("T" as const),
    }),
    [heroState.effective],
  );

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
      <MatchHeader match={data.match} players={data.players} />
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
              onRangeChange={setSelectedRange}
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
