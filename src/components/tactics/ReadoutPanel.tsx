// V2 读数面板（design-v2/tactics.md §1.2）：裸放板面，三组发丝线分隔
// 1) 筛选 chip（全体/仅我方/仅对方/仅你） 2) 图层读数（小 BigStat + mini 排行）
// 3) 区域控制（5 区域双向横条）— 荧光笔 1/1：死亡模式 top% 圆圈
import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Mark, { StaticUnderline } from "@/components/board/Mark";
import type { LayerMode, SideMode } from "./HeatmapStage";
import { zonesForMap } from "./zones";
import type { HeatPoint, Side } from "@contracts/analysis";

export type PlayerScope = "all" | "ours" | "theirs" | "you";

const SCOPE_CHIPS: [PlayerScope, string][] = [
  ["all", "全体"],
  ["ours", "仅我方"],
  ["theirs", "仅对方"],
  ["you", "仅你"],
];

interface ReadoutPanelProps {
  scope: PlayerScope;
  onScopeChange: (s: PlayerScope) => void;
  points: HeatPoint[]; // 已按 scope 过滤
  mode: LayerMode;
  side: SideMode;
  range: [number, number];
  heroName: string;
  teamT: string;
  teamCT: string;
  mapName: string;
}

export default function ReadoutPanel({
  scope,
  onScopeChange,
  points,
  mode,
  side,
  range,
  heroName,
  teamT,
  teamCT,
  mapName,
}: ReadoutPanelProps) {
  const zones = zonesForMap(mapName);
  const layerPoints = useMemo(
    () =>
      points.filter(
        (p) =>
          p.kind === mode &&
          (side === "all" || p.side === side) &&
          (p.round === undefined || (p.round >= range[0] && p.round <= range[1])),
      ),
    [points, mode, side, range],
  );

  // 图层读数：主读数 + 区域 mini 排行
  const readout = useMemo(() => {
    const heroPoints = layerPoints.filter((p) => p.player === heroName);
    const base = mode === "death" || mode === "kill" ? heroPoints : layerPoints;
    const zoneRank = new Map<string, number>();
    if (zones) {
      base.forEach((p) => {
        const z =
          zones.find((zz) => zz.test(p.x, p.y)) ?? zones[zones.length - 1];
        zoneRank.set(z.label, (zoneRank.get(z.label) ?? 0) + 1);
      });
    }
    const rank = [...zoneRank.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const total = base.length;
    const top = rank[0];
    const topPct = top && total ? Math.round((top[1] / total) * 100) : 0;
    const headline =
      mode === "utility"
        ? { count: total, pct: null as number | null, zone: null as string | null }
        : { count: total, pct: topPct, zone: top?.[0] ?? null };
    return { rank, total, topPct, headline, maxCount: top?.[1] ?? 1 };
  }, [layerPoints, mode, heroName, zones]);

  // 区域控制：按各区域双方击杀/首杀点位占比
  const zoneRows = useMemo(() => {
    if (!zones) return [] as { id: string; label: string; tPct: number; ctPct: number }[];
    const kills = points.filter((p) => p.kind === "kill" || p.kind === "firstkill");
    return zones.map((z) => {
      const inZone = kills.filter((p) => z.test(p.x, p.y));
      const t = inZone.filter((p) => p.side === "T").length;
      const ct = inZone.filter((p) => p.side === "CT").length;
      const total = t + ct;
      return {
        id: z.id,
        label: z.label,
        tPct: total ? Math.round((t / total) * 100) : 50,
        ctPct: total ? Math.round((ct / total) * 100) : 50,
      };
    });
  }, [points, zones]);

  const dominant = useMemo(() => {
    const mid = zoneRows.find((r) => r.id === "mid");
    if (!mid) return null;
    if (mid.tPct >= 55) return { team: teamT, pct: mid.tPct, side: "T" as Side };
    if (mid.ctPct >= 55) return { team: teamCT, pct: mid.ctPct, side: "CT" as Side };
    return null;
  }, [zoneRows, teamT, teamCT]);

  const headlinePrefix =
    mode === "death" ? "死亡" : mode === "kill" ? "击杀" : mode === "firstkill" ? "首杀" : "投掷";

  return (
    <div>
      {/* 组 1 · 筛选 chip */}
      <div className="flex flex-wrap items-center gap-4 pb-5">
        {SCOPE_CHIPS.map(([v, label]) => (
          <button
            key={v}
            onClick={() => onScopeChange(v)}
            className={cn(
              "relative font-mono text-[11px] transition-colors duration-200",
              scope === v ? "text-ink-1" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {label}
            {scope === v && <StaticUnderline />}
          </button>
        ))}
      </div>

      {/* 组 2 · 图层读数 */}
      <div className="border-t border-line/60 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
          {headlinePrefix}读数
        </p>
        <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
          <span className="text-3xl font-bold text-ink-1">{readout.total}</span>
          <span className="text-xs text-ink-3">次</span>
          {readout.headline.pct !== null && (
            <>
              <span className="relative inline-block text-xl font-bold text-ink-1">
                {readout.headline.pct}%
                {/* 荧光笔 1/1：仅死亡模式的 top% 圆圈 */}
                {mode === "death" && <Mark type="circle" />}
              </span>
              <span className="text-xs text-ink-3">在{readout.headline.zone ?? "—"}</span>
            </>
          )}
        </div>
        <div className="mt-4 space-y-2">
          {readout.rank.map(([zone, n], i) => (
            <div key={zone} className="flex items-center gap-2">
              <span className="w-20 shrink-0 font-mono text-xs text-ink-2">{zone}</span>
              <div className="h-[3px] flex-1 bg-board-3">
                <motion.div
                  key={`${mode}-${scope}-${side}-${range[0]}-${range[1]}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: `${(n / readout.maxCount) * 100}%`, transformOrigin: "left" }}
                  className={cn("h-full", i === 0 ? "bg-volt" : "bg-ink-3/50")}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-ink-1">
                ×{n}
              </span>
            </div>
          ))}
          {readout.rank.length === 0 && (
            <p className="py-2 text-xs text-ink-3">当前筛选无点位数据</p>
          )}
        </div>
      </div>

      {/* 组 3 · 区域控制 */}
      <div className="border-t border-line/60 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
          区域控制
        </p>
        <div className="mt-3 space-y-1">
          {zoneRows.map((r) => (
            <div key={r.id} className="flex h-8 items-center gap-2">
              <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-t-side">
                {r.tPct}
              </span>
              <div className="flex h-full flex-1 items-center">
                {/* T 向左 */}
                <div className="flex h-1.5 flex-1 justify-end bg-board-3/40">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: `${r.tPct}%`, transformOrigin: "right" }}
                    className="h-full bg-t-side/80"
                  />
                </div>
                <span className="mx-2 w-16 shrink-0 text-center text-[11px] text-ink-2">
                  {r.label}
                </span>
                {/* CT 向右 */}
                <div className="h-1.5 flex-1 bg-board-3/40">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: `${r.ctPct}%`, transformOrigin: "left" }}
                    className="h-full bg-ct-side/80"
                  />
                </div>
              </div>
              <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums text-ct-side">
                {r.ctPct}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-2">
          {dominant
            ? `${dominant.team} 凭中路控制（${dominant.pct}%）主导了${dominant.side === "T" ? " T 方" : " CT 方"}节奏。`
            : "双方中路控制接近，地图控制权未出现明显倾斜。"}
        </p>
      </div>
    </div>
  );
}
