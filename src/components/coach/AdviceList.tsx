// V2 建议清单（coach.md §2）：板面批注条，不是卡片。
// 每条 = 优先级色点 + 分类 + 预估提升 / 标题 / 正文 / 证据 chips / 关联回合平铺。
// P1 条目右侧挂一张迷你手写边注；排名第 1 的建议标题下手绘下划线（本页标记 2/2）。
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { CoachAdvice, RoundSummary } from "@contracts/analysis";
import CoachNote from "@/components/board/CoachNote";
import Mark from "@/components/board/Mark";
import RoundChip from "@/components/match/RoundChip";
import { CATEGORY_META, PRIORITY_META } from "@/components/player/utils";

/** P1 手写边注（coach.md 指定文案，按分类映射） */
const P1_MARGIN_NOTES: Partial<Record<CoachAdvice["category"], string>> = {
  aim: "先瞄头，再开枪。",
  positioning: "活下来，比首杀重要。",
  economy: "$2,400 不配全甲步枪。",
};

interface AdviceItemProps {
  advice: CoachAdvice;
  matchId: string;
  rounds: RoundSummary[];
  /** 全清单第 1 条：标题下加荧光笔下划线 */
  isFirst: boolean;
  noteTilt: "left" | "right";
}

function AdviceItem({ advice, matchId, rounds, isFirst, noteTilt }: AdviceItemProps) {
  const navigate = useNavigate();
  const pri = PRIORITY_META[advice.priority];
  const marginNote = advice.priority === 1 ? P1_MARGIN_NOTES[advice.category] : undefined;
  const related = advice.relatedRounds
    .map((n) => rounds.find((r) => r.round === n))
    .filter((r): r is RoundSummary => !!r);

  return (
    <article className="relative border-b border-line/60 py-6">
      <div className={cn(marginNote && "lg:pr-[230px]")}>
        {/* 行头：优先级色点 + 分类 + 预估提升 */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", pri.dot)} aria-hidden />
          <span className={cn("font-mono text-[10px] font-bold tracking-wider", pri.text)}>
            {pri.label}
          </span>
          <span className="text-[10px] uppercase tracking-[0.22em] text-ink-3">
            {CATEGORY_META[advice.category].label}
          </span>
          {advice.player && (
            <span className="font-mono text-[10px] text-ink-3">@ {advice.player}</span>
          )}
          <span className="ml-auto font-mono text-xs tabular-nums text-success">
            预估提升 +{pri.estimate.toFixed(2)} Rating
          </span>
        </div>

        {/* 标题（第 1 条加手绘下划线） */}
        <h3 className="mt-2 font-display text-base font-semibold text-ink-1">
          <span className="relative inline-block">
            {advice.title}
            {isFirst && (
              <span className="absolute -bottom-1.5 left-[-3%] right-[-3%] h-2.5">
                <Mark type="underline" className="!inset-0" delay={0.8} />
              </span>
            )}
          </span>
        </h3>

        {/* 正文（Inter，不用手写体） */}
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{advice.description}</p>

        {/* 支撑数据 chips */}
        {advice.evidence.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {advice.evidence.map((e, i) => (
              <span
                key={i}
                className="rounded-sm border border-line px-2 py-1 font-mono text-xs text-ink-2"
              >
                {e.label} <span className="font-bold text-ink-1">{e.value}</span>
                {e.ref && <span className="text-ink-3">（{e.ref}）</span>}
              </span>
            ))}
          </div>
        )}

        {/* 相关回合（平铺，点击跳 rounds 页） */}
        {related.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-[0.22em] text-ink-3">
              相关回合
            </span>
            {related.map((r) => (
              <RoundChip
                key={r.round}
                round={r}
                onClick={() => navigate(`/match/${matchId}/rounds`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* P1 手写边注（桌面端右缘） */}
      {marginNote && (
        <CoachNote
          tilt={noteTilt}
          className="absolute right-0 top-6 hidden w-[190px] !p-3 lg:block [&>div]:!text-lg"
        >
          {marginNote}
        </CoachNote>
      )}
    </article>
  );
}

interface AdviceListProps {
  personal: CoachAdvice[];
  team: CoachAdvice[];
  matchId: string;
  rounds: RoundSummary[];
}

export default function AdviceList({ personal, team, matchId, rounds }: AdviceListProps) {
  const firstId = (personal[0] ?? team[0])?.id;

  if (personal.length === 0 && team.length === 0) {
    return <p className="py-8 text-sm text-ink-3">本场暂无建议，继续保持。</p>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {personal.map((a, i) => (
        <AdviceItem
          key={a.id}
          advice={a}
          matchId={matchId}
          rounds={rounds}
          isFirst={a.id === firstId}
          noteTilt={i % 2 === 0 ? "right" : "left"}
        />
      ))}

      {/* 团队层面分组 */}
      {team.length > 0 && (
        <>
          <div className="flex items-center gap-3 pt-8">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
              团队层面 Team-Level
            </span>
            <span className="h-px flex-1 bg-line" aria-hidden />
          </div>
          {team.map((a, i) => (
            <AdviceItem
              key={a.id}
              advice={a}
              matchId={matchId}
              rounds={rounds}
              isFirst={a.id === firstId}
              noteTilt={i % 2 === 0 ? "right" : "left"}
            />
          ))}
        </>
      )}
    </motion.div>
  );
}
