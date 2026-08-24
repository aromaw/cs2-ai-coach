// 荧光笔标记 <Mark> — V2 签名元素（design-v2 §6.2）
// volt 手绘感 SVG 笔迹，覆盖在关键数字上；进入视口后 "画出来"（draw 动画）。
// 纪律：每页 ≤3 处，只标记本页最重要的数字。
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type MarkType = "circle" | "underline" | "arrow";

interface MarkProps {
  type?: MarkType;
  className?: string;
  /** draw 动画延迟（默认 0.4s，等宿主内容入场完） */
  delay?: number;
}

// 手绘感 path（轻微抖动静态写死，非完美几何）
const PATHS: Record<MarkType, string> = {
  // 100x60 viewBox 的不规整椭圆
  circle:
    "M 52 4 C 78 3, 98 14, 97 30 C 96 48, 74 58, 48 57 C 24 56, 4 46, 5 29 C 6 13, 28 2, 54 4",
  // 100x16 viewBox 的微波浪下划线
  underline: "M 3 10 C 25 6, 45 13, 68 9 C 82 7, 93 11, 98 9",
  // 100x80 viewBox 的弧线箭头（从左上到右下）
  arrow: "M 8 8 C 35 10, 65 28, 78 58 M 78 58 L 66 52 M 78 58 L 70 44",
};

const VIEWBOX: Record<MarkType, string> = {
  circle: "0 0 100 60",
  underline: "0 0 100 16",
  arrow: "0 0 100 80",
};

export default function Mark({ type = "circle", className, delay = 0.4 }: MarkProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => e.isIntersecting && setInView(true),
      { threshold: 0.3 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      viewBox={VIEWBOX[type]}
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute overflow-visible", className)}
      style={{ left: "-12%", right: "-12%", top: "-18%", bottom: "-18%" }}
      aria-hidden
    >
      <motion.path
        d={PATHS[type]}
        fill="none"
        stroke="#C8FF3D"
        strokeWidth={type === "circle" ? 2.5 : 2.2}
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 5px rgba(200,255,61,0.35))" }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{
          pathLength: { duration: 0.8, delay, ease: [0.4, 0, 0.2, 1] },
          opacity: { duration: 0.01, delay },
        }}
      />
    </svg>
  );
}

/** 静态荧光笔下划线（无 draw 动画）——用于 Navbar 激活态 / tab 激活态 */
export function StaticUnderline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 16"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-x-0 -bottom-1 h-2 w-full", className)}
      aria-hidden
    >
      <path
        d={PATHS.underline}
        fill="none"
        stroke="#C8FF3D"
        strokeWidth={2.5}
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 4px rgba(200,255,61,0.3))" }}
      />
    </svg>
  );
}
