// HUD 角框面板（design-v2 §6.1）：无背景无完整描边，仅四角 L 形括线。
// 每页最多 1-2 个，只框"本页主角"。
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CORNERS = [
  "left-0 top-0 border-l border-t",
  "right-0 top-0 border-r border-t",
  "bottom-0 left-0 border-b border-l",
  "bottom-0 right-0 border-b border-r",
];

export default function HudFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => e.isIntersecting && setInView(true),
      { threshold: 0.15 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("relative p-6", className)}>
      {CORNERS.map((pos, i) => (
        <span
          key={pos}
          className={cn(
            "absolute h-3.5 w-3.5 border-[1.5px] border-ink-3 transition-all duration-300",
            pos,
          )}
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "scale(1)" : "scale(0.3)",
            transitionDelay: `${i * 50}ms`,
            transformOrigin: pos.includes("left")
              ? pos.includes("top") ? "left top" : "left bottom"
              : pos.includes("top") ? "right top" : "right bottom",
          }}
        />
      ))}
      {children}
    </div>
  );
}
