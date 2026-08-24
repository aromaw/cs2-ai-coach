import { cn } from "@/lib/utils";
import type { Side } from "@contracts/analysis";

export default function SideBadge({ side, className }: { side: Side; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-7 items-center justify-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold",
        side === "T"
          ? "border-t-side/30 bg-t-dim text-t-side"
          : "border-ct-side/30 bg-ct-dim text-ct-side",
        className,
      )}
    >
      {side}
    </span>
  );
}
