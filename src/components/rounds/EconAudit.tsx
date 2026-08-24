// V2 经济决策审计（design-v2/rounds.md §S3）：≤5 条开放行式列表，无卡片
// 点击行 → 联动时间线展开对应回合；收尾 CoachNote 便签
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import SectionHeader from "@/components/board/SectionHeader";
import CoachNote from "@/components/board/CoachNote";
import RoundChip from "@/components/match/RoundChip";
import { BUY_SHORT, sideName, type EconAuditItem, type Verdict } from "./econ-utils";
import type { RoundSummary } from "@contracts/analysis";

const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  good: { label: "✓ 合理", cls: "border-good/40 text-good" },
  bad: { label: "✗ 失误", cls: "border-bad/40 text-bad" },
  neutral: { label: "△ 存疑", cls: "border-warn/40 text-warn" },
};

/** 金额数字 count-up（0.8s，inView 一次） */
function CountMoney({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const tick = () => {
            const p = Math.min(1, (performance.now() - t0) / 800);
            setDisplay(value * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [value]);

  const v = Math.round(display);
  return (
    <span
      ref={ref}
      className={cn(
        "shrink-0 font-mono text-sm font-bold tabular-nums",
        value >= 0 ? "text-good" : "text-bad",
      )}
    >
      {v >= 0 ? "+" : "-"}${Math.abs(v).toLocaleString("en-US")}
    </span>
  );
}

interface EconAuditProps {
  items: EconAuditItem[];
  rounds: RoundSummary[];
  teamT: string;
  teamCT: string;
  onJump: (round: number) => void;
}

export default function EconAudit({ items, rounds, teamT, teamCT, onJump }: EconAuditProps) {
  // V2: 6 条 → ≤5 条，按金额影响绝对值排序保留最有分量的
  const top = topByImpact(items);
  const worst = top.find((i) => i.verdict === "bad");

  return (
    <section className="max-w-4xl">
      <SectionHeader
        title="经济决策审计"
        en="ECON DECISIONS"
        note="每一次非常规购买，系统都给出判定。"
      />
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4 }}
      >
        {top.length === 0 && (
          <p className="py-4 text-sm text-ink-3">本场未发现显著的非默认购买决策。</p>
        )}
        {top.map((item) => {
          const round = rounds.find((r) => r.round === item.round);
          const vs = VERDICT_STYLE[item.verdict];
          return (
            <button
              key={`${item.round}-${item.side}`}
              onClick={() => onJump(item.round)}
              className="group flex w-full items-center gap-4 border-b border-line/60 py-4 text-left transition-colors duration-200 hover:bg-board-2/60"
            >
              {round && <RoundChip round={round} />}
              <span
                className={cn(
                  "w-16 shrink-0 font-mono text-xs uppercase",
                  item.side === "T" ? "text-t-side" : "text-ct-side",
                )}
              >
                {sideName(item.side, teamT, teamCT)}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[10px]",
                  vs.cls,
                )}
              >
                {vs.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
                {BUY_SHORT[item.buyType]} —— {item.detail}
              </span>
              <CountMoney value={item.impact} />
            </button>
          );
        })}
      </motion.div>

      {/* 收尾便签 */}
      <CoachNote className="mt-8 max-w-md">
        {worst
          ? `※ R${worst.round} 那波${BUY_SHORT[worst.buyType]}是全队输经济的转折点。记住：均资不足就别碰全甲步枪。`
          : "※ 本场购买决策整体在纪律之内，保持这个节奏。"}
      </CoachNote>
    </section>
  );
}

function topByImpact(items: EconAuditItem[]): EconAuditItem[] {
  return [...items].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 5);
}
