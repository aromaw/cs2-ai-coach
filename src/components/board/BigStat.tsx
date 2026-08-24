// BigStat 读数块（design-v2 §7.4）：裸读数直接排在板面上，无卡片。
// 多个 BigStat 用父容器 `divide-x divide-line/60` 的竖发丝线分隔。
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Mark from "./Mark";

interface BigStatProps {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  reference?: string;
  trend?: "up" | "down";
  /** 本页最重要读数可外套荧光圈（计入每页标记配额） */
  marked?: boolean;
  className?: string;
}

export default function BigStat({
  label,
  value,
  decimals = 1,
  suffix = "",
  reference,
  trend,
  marked,
  className,
}: BigStatProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
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
            const p = Math.min(1, (performance.now() - t0) / 1000);
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

  return (
    <div ref={ref} className={cn("px-5 py-1 first:pl-0", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
        {label}
      </p>
      <div className="relative mt-1.5 inline-block">
        <span className="font-mono text-5xl font-bold tabular-nums leading-none text-ink-1">
          {display.toFixed(decimals)}
        </span>
        {suffix && (
          <span className="ml-1 font-mono text-xl text-ink-3">{suffix}</span>
        )}
        {marked && <Mark type="circle" />}
      </div>
      {reference && (
        <p className="mt-2 text-xs text-ink-3">
          {reference}
          {trend && (
            <span className={trend === "up" ? "ml-1 text-good" : "ml-1 text-bad"}>
              {trend === "up" ? "▲" : "▼"}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
