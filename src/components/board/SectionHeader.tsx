// 分区头（design-v2 §6.5）：[准星] 中文名 英文名 ─────发丝线
import CrossMark from "./CrossMark";
import { cn } from "@/lib/utils";

export default function SectionHeader({
  title,
  en,
  note,
  action,
  className,
}: {
  title: string;
  en?: string;
  note?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex items-center gap-3">
        <CrossMark size={14} />
        <h2 className="font-display text-base font-semibold uppercase tracking-[0.18em] text-ink-1">
          {title}
        </h2>
        {en && (
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
            {en}
          </span>
        )}
        <span className="h-px flex-1 bg-line" aria-hidden />
        {action}
      </div>
      {note && <p className="mt-2 pl-[26px] text-xs text-ink-3">{note}</p>}
    </div>
  );
}
