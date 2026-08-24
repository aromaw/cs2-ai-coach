// 教练便签（design-v2 §6.4）：手写批注，战术板边的马克笔便签
import { cn } from "@/lib/utils";

export default function CoachNote({
  children,
  tilt = "left",
  className,
}: {
  children: React.ReactNode;
  tilt?: "left" | "right";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-sm border border-dashed border-volt/25 bg-volt-dim p-4 transition-transform duration-200 hover:rotate-0 md:p-5",
        tilt === "left" ? "-rotate-1" : "rotate-[0.8deg]",
        className,
      )}
    >
      {/* 顶部胶带 */}
      <span
        className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 rotate-2 bg-volt/15"
        aria-hidden
      />
      <div className="font-hand text-xl leading-[1.35] text-volt-soft md:text-2xl">
        {children}
      </div>
    </div>
  );
}
