// V2 本周训练清单（coach.md §3）：纵向三组 checklist（V1 横向三卡 → 纵向三组）。
// 勾选 = volt ✓ SVG draw（0.3s）+ 文字划线变淡；本地持久化保留。
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { CoachAdvice } from "@contracts/analysis";

interface TrainingItem {
  id: string;
  text: string;
  rounds: number[];
}

interface TrainingGroup {
  key: string;
  title: string;
  items: TrainingItem[];
}

function buildGroups(advice: CoachAdvice[]): TrainingGroup[] {
  const groups: TrainingGroup[] = [
    { key: "aim", title: "AIM 枪法", items: [] },
    { key: "utility", title: "UTILITY 道具", items: [] },
    { key: "review", title: "REVIEW 复盘", items: [] },
  ];
  for (const a of advice) {
    const evidence = a.evidence[0];
    const suffix = evidence ? `（${evidence.label} ${evidence.value}）` : "";
    if (a.category === "aim") {
      groups[0].items.push({
        id: a.id,
        text: `预瞄头线特训 15min/天 + 死斗只打头${suffix}`,
        rounds: a.relatedRounds.slice(0, 3),
      });
    } else if (a.category === "utility") {
      groups[1].items.push({
        id: a.id,
        text: `包点爆弹位练习 20min + 瞬爆闪配合演练${suffix}`,
        rounds: a.relatedRounds.slice(0, 3),
      });
    } else {
      const verb =
        a.category === "economy"
          ? "复盘购买决策，强起前检查连败缓冲"
          : a.category === "positioning"
            ? "复盘开局走位与前压时机，记录每次前压的信息依据"
            : "复盘补枪位与团队协同";
      groups[2].items.push({
        id: a.id,
        text: `${verb}${suffix}`,
        rounds: a.relatedRounds.slice(0, 3),
      });
    }
  }
  return groups.filter((g) => g.items.length > 0);
}

/** 复选框：勾选时 volt ✓ 描边画出（0.3s） */
function Checkbox({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors duration-200",
        on ? "border-volt" : "border-line-strong hover:border-ink-3",
      )}
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
        <motion.path
          d="M 2 6.5 L 5 9.5 L 10 2.5"
          fill="none"
          stroke="#C8FF3D"
          strokeWidth={2}
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </button>
  );
}

interface TrainingPlanProps {
  advice: CoachAdvice[];
  matchId: string;
}

export default function TrainingPlan({ advice, matchId }: TrainingPlanProps) {
  const storageKey = `retake-training-${matchId}`;
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {
      /* ignore */
    }
  }, [checked, storageKey]);

  const groups = useMemo(() => buildGroups(advice), [advice]);
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  const done = groups.reduce(
    (s, g) => s + g.items.filter((it) => checked[it.id]).length,
    0,
  );
  const pct = total > 0 ? (done / total) * 100 : 0;

  if (total === 0) return null;

  return (
    <div>
      {groups.map((g, gi) => (
        <div key={g.key} className={cn("py-5", gi > 0 && "border-t border-line/60")}>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-volt">
            {g.title}
          </p>
          <ul className="mt-3 space-y-3">
            {g.items.map((it) => {
              const on = !!checked[it.id];
              return (
                <li key={it.id}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      on={on}
                      onToggle={() => setChecked((prev) => ({ ...prev, [it.id]: !prev[it.id] }))}
                    />
                    <span
                      className={cn(
                        "text-sm leading-snug transition-all duration-300",
                        on ? "text-ink-2 line-through opacity-45" : "text-ink-2",
                      )}
                    >
                      {it.text}
                    </span>
                  </div>
                  {it.rounds.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap gap-1 pl-7">
                      {it.rounds.map((r) => (
                        <Link
                          key={r}
                          to={`/match/${matchId}/rounds`}
                          className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-3 transition-colors duration-200 hover:border-volt/60 hover:text-volt"
                        >
                          R{r}
                        </Link>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* 底部进度行 */}
      <div className="mt-4 flex items-center gap-4">
        <span className="font-mono text-xs tabular-nums text-ink-3">
          本周完成 {done} / {total}
        </span>
        <div className="h-0.5 flex-1 bg-line">
          <div
            className="h-full bg-volt transition-all duration-[400ms]"
            style={{ width: `${pct}%`, transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
          />
        </div>
      </div>

      {/* 收尾 CTA */}
      <div className="mt-10 text-center">
        <Link
          to="/"
          className="inline-block rounded-sm border border-volt/60 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-volt transition-colors duration-200 hover:bg-volt hover:text-board-0"
        >
          上传下一场 Demo，检验你的进步 →
        </Link>
      </div>
    </div>
  );
}
