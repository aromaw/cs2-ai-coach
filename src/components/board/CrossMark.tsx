// 准星 motif（design-v2 §6.3）：静态符号，禁止动画
import { cn } from "@/lib/utils";

export default function CrossMark({
  className,
  volt = false,
  size = 16,
}: {
  className?: string;
  volt?: boolean;
  size?: number;
}) {
  const c = volt ? "#C8FF3D" : "#5B6873";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {/* 上下左右四线，中心 4px 缺口 */}
      <line x1="8" y1="1" x2="8" y2="6" stroke={c} strokeWidth="1.5" />
      <line x1="8" y1="10" x2="8" y2="15" stroke={c} strokeWidth="1.5" />
      <line x1="1" y1="8" x2="6" y2="8" stroke={c} strokeWidth="1.5" />
      <line x1="10" y1="8" x2="15" y2="8" stroke={c} strokeWidth="1.5" />
    </svg>
  );
}
