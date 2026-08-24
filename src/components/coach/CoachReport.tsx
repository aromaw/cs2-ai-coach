// V2 教练报告头（coach.md §1）：板面微光下，左 8 列 HudFrame + 手写总评便签，
// 右 4 列三个汇总裸读数。荧光笔：便签中的预估提升数字外套手绘圈（本页标记 1/2）。
import { cn } from "@/lib/utils";
import type { AnalysisResult, CoachAdvice, PlayerStat } from "@contracts/analysis";
import HudFrame from "@/components/board/HudFrame";
import CoachNote from "@/components/board/CoachNote";
import Mark, { StaticUnderline } from "@/components/board/Mark";
import {
  CATEGORY_META,
  PRIORITY_META,
  radarScores,
  teamRadarAvg,
  useCountUp,
} from "@/components/player/utils";

export type CoachView = "player" | "team";

interface CoachReportProps {
  data: AnalysisResult;
  player: PlayerStat;
  view: CoachView;
  onViewChange: (v: CoachView) => void;
  /** 当前视角范围内的全部建议（个人 + 团队层面） */
  advice: CoachAdvice[];
}

function SummaryNumber({
  value,
  decimals = 0,
  prefix = "",
  label,
  tone = "text-ink-1",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  label: string;
  tone?: string;
}) {
  const { ref, display } = useCountUp(value, 900);
  return (
    <div>
      <p className={cn("font-mono text-4xl font-bold tabular-nums", tone)}>
        <span ref={ref}>
          {prefix}
          {display.toFixed(decimals)}
        </span>
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
        {label}
      </p>
    </div>
  );
}

export default function CoachReport({ data, player, view, onViewChange, advice }: CoachReportProps) {
  const p1 = advice.filter((a) => a.priority === 1).length;
  const estimate = advice.reduce((s, a) => s + PRIORITY_META[a.priority].estimate, 0);

  // 优势：高于全队平均最多的两个雷达维度
  const scores = radarScores(player);
  const avg = teamRadarAvg(data.players, player.teamName);
  const strengths = scores
    .map((s, i) => ({ ...s, diff: s.value - (avg[i] ?? 0) }))
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 2)
    .map((s) => s.short);
  // 短板：P1 建议的分类标签（去重，至多 3 个）
  const weaknesses = [
    ...new Set(
      advice.filter((a) => a.priority === 1).map((a) => CATEGORY_META[a.category].label),
    ),
  ].slice(0, 3);

  const estText = `+${estimate.toFixed(2)}`;

  return (
    <section className="board-glow grid grid-cols-1 gap-10 py-10 lg:grid-cols-12">
      {/* 左：总评便签（HudFrame 组） */}
      <div className="lg:col-span-8">
        <HudFrame className="p-8">
          {/* 抬头行（非手写）+ 对象切换 */}
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
              Coach Report · 对象: {view === "player" ? `${player.name}（你）` : "全队"}
            </p>
            <div className="ml-auto flex items-center gap-1">
              {(
                [
                  { key: "player" as CoachView, label: "你" },
                  { key: "team" as CoachView, label: `${player.teamName} 全队` },
                ]
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => onViewChange(t.key)}
                  className={cn(
                    "relative px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-200",
                    view === t.key ? "text-ink-1" : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  {t.label}
                  {view === t.key && <StaticUnderline />}
                </button>
              ))}
            </div>
          </div>

          {/* 总评便签（手写 ≤4 行，产品签名时刻） */}
          <CoachNote className="mt-6" tilt="left">
            {view === "player" ? (
              <>
                这场 Rating {player.rating.toFixed(2)}、首杀对枪胜率{" "}
                {player.openingDuelWinRate.toFixed(0)}% ——{" "}
                {strengths.length > 0 ? `${strengths.join("与")}是最强武器` : "整体发挥平稳"}
                。短板同样清晰：
                {weaknesses.length > 0 ? weaknesses.join("、") : "暂无明显短板"}。逐条修掉，
                Rating 还有{" "}
                <span className="relative inline-block px-1">
                  {estText}
                  <Mark type="circle" delay={0.6} />
                </span>{" "}
                的空间。
              </>
            ) : (
              <>
                全队本场 {data.match.scoreT}:{data.match.scoreCT}，共 {advice.length} 条待办，
                其中 P1 高优先 {p1} 条
                {weaknesses.length > 0 ? `，集中在${weaknesses.join("、")}` : ""}
                。按优先级逐条执行，全队 Rating 预估还有{" "}
                <span className="relative inline-block px-1">
                  {estText}
                  <Mark type="circle" delay={0.6} />
                </span>{" "}
                的空间。
              </>
            )}
          </CoachNote>
        </HudFrame>
      </div>

      {/* 右：三个汇总数字（裸读数竖排，竖发丝线左缘） */}
      <div className="flex flex-row gap-10 border-l border-line pl-6 lg:col-span-4 lg:flex-col lg:justify-center lg:gap-6">
        <SummaryNumber value={advice.length} label="建议总数" />
        <SummaryNumber value={p1} label="P1 高优先" tone="text-danger" />
        <SummaryNumber value={estimate} decimals={2} prefix="+" label="Rating 空间" tone="text-success" />
      </div>
    </section>
  );
}
