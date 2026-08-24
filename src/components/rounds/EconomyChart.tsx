// V2 经济曲线（design-v2/rounds.md §S2）：本页唯一大图
// AreaChart（装备价值 / 累计经济差）+ 换边线 + 限量 3 条关键回合旗标
// 荧光笔 2/2：R-pivot 便签 + Mark arrow 指向曲线转折点
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import SectionHeader from "@/components/board/SectionHeader";
import CoachNote from "@/components/board/CoachNote";
import Mark, { StaticUnderline } from "@/components/board/Mark";
import { BUY_SHORT } from "./econ-utils";
import type { AnalysisResult, RoundSummary } from "@contracts/analysis";

type Mode = "value" | "diff";

const fmt$ = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const fmtSigned = (n: number) =>
  `${n >= 0 ? "+" : "-"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export interface PivotInfo {
  round: number;
  impact: number;
  buyType: RoundSummary["buyTypeT"];
}

/** 关键回合旗标（volt 小旗，手绘感三角旗） */
function FlagLabel(props: { viewBox?: { x?: number; y?: number } }) {
  const x = props.viewBox?.x ?? 0;
  return (
    <g transform={`translate(${x - 1}, 2)`}>
      <line x1="0" y1="0" x2="0" y2="12" stroke="#C8FF3D" strokeWidth="1.5" />
      <path d="M 0 1 L 9 4.5 L 0 8 Z" fill="#C8FF3D" fillOpacity="0.9" />
    </g>
  );
}

interface EcoTooltipProps {
  active?: boolean;
  label?: number;
  teamT: string;
  teamCT: string;
  rounds: RoundSummary[];
  mode: Mode;
  diffs: Map<number, number>;
}

function EcoTooltip({ active, label, teamT, teamCT, rounds, mode, diffs }: EcoTooltipProps) {
  if (!active || label === undefined) return null;
  const r = rounds.find((x) => x.round === label);
  if (!r) return null;
  const diff = diffs.get(label) ?? 0;
  return (
    <div className="rounded-sm border border-line-strong bg-board-3 p-3 font-mono text-[11px] tabular-nums text-ink-1">
      <p className="mb-1 font-bold">R{r.round}</p>
      <p>
        <span className="text-t-side">{teamT}</span> {fmt$(r.equipValueT)}（{BUY_SHORT[r.buyTypeT]}）
      </p>
      <p>
        <span className="text-ct-side">{teamCT}</span> {fmt$(r.equipValueCT)}（{BUY_SHORT[r.buyTypeCT]}）
      </p>
      <p className="mt-1 text-ink-3">
        差 <span className={diff >= 0 ? "text-volt" : "text-bad"}>{fmtSigned(diff)}</span>
        {mode === "diff" ? " · 累计" : ""}
      </p>
    </div>
  );
}

interface EconomyChartProps {
  data: AnalysisResult;
  pivot: PivotInfo | null;
}

export default function EconomyChart({ data, pivot }: EconomyChartProps) {
  const [mode, setMode] = useState<Mode>("value");
  const { economy, rounds, match } = data;
  // 主线 draw 仅首次入场享有（本页唯一 draw 图表）；模式切换走 0.3s 交叉淡入
  const [drawn, setDrawn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timer.current = setTimeout(() => setDrawn(true), 1700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const { chartData, diffs } = useMemo(() => {
    let cum = 0;
    const diffs = new Map<number, number>();
    const chartData = economy.map((e) => {
      const r = rounds.find((x) => x.round === e.round);
      // 胜方装备保留、败方装备清零：胜负加权的装备差近似回合经济流向
      if (r) cum += r.winner === "T" ? r.equipValueT : -r.equipValueCT;
      diffs.set(e.round, cum);
      return { ...e, diff: cum };
    });
    return { chartData, diffs };
  }, [economy, rounds]);

  // 关键回合旗标：限量 3 条，优先 eco 翻盘 → 赛点 → 其他关键
  const flagRounds = useMemo(() => {
    const keys = rounds.filter((r) => r.isKeyRound && r.keyReason !== "手枪局");
    const pickRank = (r: RoundSummary) =>
      r.keyReason === "eco 翻盘" ? 0 : r.keyReason === "赛点局" ? 1 : 2;
    const sorted = [...keys].sort((a, b) => pickRank(a) - pickRank(b) || a.round - b.round);
    return sorted.slice(0, 3).map((r) => r.round);
  }, [rounds]);

  const halfRound = Math.floor(match.roundsTotal / 2);

  // 累计差模式：0 线位置的渐变断点（上 volt / 下 bad）
  const diffDomain = useMemo(() => {
    const vals = chartData.map((d) => d.diff);
    const max = Math.max(0, ...vals);
    const min = Math.min(0, ...vals);
    return { max, min, zeroOffset: max - min === 0 ? 1 : max / (max - min) };
  }, [chartData]);

  return (
    <section>
      <SectionHeader
        title="经济走势"
        en="ECONOMY"
        action={
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-3 font-mono text-[10px] text-ink-3 sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-t-side" />
                {match.teamTName}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-ct-side" />
                {match.teamCTName}
              </span>
            </span>
            {(
              [
                ["value", "装备价值"],
                ["diff", "累计经济差"],
              ] as [Mode, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                className={cn(
                  "relative font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-200",
                  mode === v ? "text-ink-1" : "text-ink-3 hover:text-ink-2",
                )}
              >
                {label}
                {mode === v && <StaticUnderline />}
              </button>
            ))}
          </div>
        }
      />

      <div className="relative">
        {/* 转折点便签 + 荧光笔箭头（本页标记 2/2） */}
        {pivot && (
          <>
            <CoachNote className="absolute right-0 top-0 z-10 max-w-[220px]" tilt="right">
              → R{pivot.round} 这一回合的{BUY_SHORT[pivot.buyType]}，值{" "}
              {fmtSigned(pivot.impact)}。
            </CoachNote>
            {/* 荧光笔箭头：从便签左下指向曲线转折点（! 覆盖 Mark 默认的宿主 overlay 定位） */}
            <Mark
              type="arrow"
              delay={1.8}
              className="z-10 !bottom-auto !left-auto !right-[228px] !top-12 h-14 w-16 -scale-x-100"
            />
          </>
        )}

        <motion.div
          key={mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="h-[280px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 16, right: 12, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="ecoT" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFB020" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#FFB020" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ecoCT" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4DA3FF" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#4DA3FF" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ecoDiff" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor="#C8FF3D" stopOpacity={0.2} />
                  <stop offset={diffDomain.zeroOffset} stopColor="#C8FF3D" stopOpacity={0.04} />
                  <stop offset={diffDomain.zeroOffset} stopColor="#FF5252" stopOpacity={0.04} />
                  <stop offset={1} stopColor="#FF5252" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#222C37" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="round"
                tick={{ fill: "#5B6873", fontSize: 11, fontFamily: "JetBrains Mono" }}
                tickFormatter={(v: number) => `R${v}`}
                stroke="#222C37"
              />
              <YAxis
                tick={{ fill: "#5B6873", fontSize: 11, fontFamily: "JetBrains Mono" }}
                tickFormatter={(v: number) =>
                  Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                }
                stroke="#222C37"
                width={42}
              />
              <Tooltip
                content={
                  <EcoTooltip
                    teamT={match.teamTName}
                    teamCT={match.teamCTName}
                    rounds={rounds}
                    mode={mode}
                    diffs={diffs}
                  />
                }
              />
              {/* 换边线 */}
              <ReferenceLine
                x={halfRound + 0.5}
                stroke="#33404E"
                strokeWidth={1}
                label={{
                  value: "HALFTIME",
                  position: "insideTopRight",
                  fill: "#5B6873",
                  fontSize: 9,
                  fontFamily: "JetBrains Mono",
                }}
              />
              {/* 关键回合虚线 + 旗标（限量 3） */}
              {flagRounds.map((r) => (
                <ReferenceLine
                  key={r}
                  x={r}
                  stroke="#C8FF3D"
                  strokeOpacity={0.3}
                  strokeDasharray="4 4"
                  label={<FlagLabel />}
                />
              ))}
              {mode === "value" ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="valueT"
                    name={match.teamTName}
                    stroke="#FFB020"
                    strokeWidth={2}
                    fill="url(#ecoT)"
                    animationDuration={drawn ? 300 : 1500}
                    animationEasing="ease-out"
                  />
                  <Area
                    type="monotone"
                    dataKey="valueCT"
                    name={match.teamCTName}
                    stroke="#4DA3FF"
                    strokeWidth={2}
                    fill="url(#ecoCT)"
                    animationDuration={drawn ? 300 : 1500}
                    animationEasing="ease-out"
                  />
                </>
              ) : (
                <Area
                  type="stepAfter"
                  dataKey="diff"
                  name="累计经济差"
                  stroke="#C8FF3D"
                  strokeWidth={2}
                  fill="url(#ecoDiff)"
                  animationDuration={300}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </section>
  );
}
