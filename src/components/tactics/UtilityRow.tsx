// V2 道具行（design-v2/tactics.md §S2）：一行 4 个裸读数，竖发丝线分隔
// 收尾 CoachNote（闪光纪律）；无卡片、无 mini 柱图
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import SectionHeader from "@/components/board/SectionHeader";
import CoachNote from "@/components/board/CoachNote";
import type { PlayerStat, Side, UtilityStats } from "@contracts/analysis";

type SideTab = "all" | "T" | "CT";

/** 读数 count-up（0.8s，inView 一次） */
function useCountUp(value: number, duration = 800): number {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(value);
  ref.current = value;
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / duration);
      setDisplay(ref.current * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

function UtilityStat({
  label,
  en,
  dot,
  value,
  sub,
}: {
  label: string;
  en: string;
  dot: string; // 道具色点 hex
  value: number;
  sub: string;
}) {
  const display = useCountUp(value);
  return (
    <div className="px-6 py-1 first:pl-0">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
        {label} <span className="text-ink-3/70">{en}</span>
      </p>
      <p className="mt-2 font-mono text-4xl font-bold tabular-nums leading-none text-ink-1">
        {Math.round(display)}
      </p>
      <p className="mt-2.5 text-xs text-ink-3">{sub}</p>
    </div>
  );
}

interface UtilityRowProps {
  utility: UtilityStats[];
  players: PlayerStat[];
  roundsTotal: number;
  teamT: string;
}

export default function UtilityRow({ utility, players, roundsTotal, teamT }: UtilityRowProps) {
  const [side, setSide] = useState<SideTab>("all");

  const sideOf = useMemo(() => {
    const m = new Map<string, Side>();
    players.forEach((p) => m.set(p.name, p.startSide));
    return m;
  }, [players]);

  const filtered = useMemo(
    () => utility.filter((u) => side === "all" || sideOf.get(u.player) === side),
    [utility, side, sideOf],
  );

  const sum = (fn: (u: UtilityStats) => number) => filtered.reduce((a, u) => a + fn(u), 0);
  const topBy = (fn: (u: UtilityStats) => number) =>
    filtered.reduce<UtilityStats | null>(
      (best, u) => (best === null || fn(u) > fn(best) ? u : best),
      null,
    );

  const flashes = sum((u) => u.flashes);
  const smokes = sum((u) => u.smokes);
  const molotovs = sum((u) => u.molotovs);
  const hes = sum((u) => u.hes);
  const flashAssists = sum((u) => u.flashAssists);
  const utilDmg = sum((u) => u.utilityDamage);
  const avgBlind = filtered.length
    ? filtered.reduce((a, u) => a + u.avgBlindDuration * u.flashes, 0) / Math.max(flashes, 1)
    : 0;
  // 燃烧/手雷伤害拆分（按投掷数占比估算）
  const moloDmg = Math.round(utilDmg * (molotovs / Math.max(molotovs + hes, 1)));
  const heDmg = utilDmg - moloDmg;
  const topSmoke = topBy((u) => u.smokes);
  const topHe = topBy((u) => u.hes);

  // 教练注：T 方闪光助攻 / 回合
  const tFlashAssists = utility
    .filter((u) => sideOf.get(u.player) === "T")
    .reduce((a, u) => a + u.flashAssists, 0);
  const perRound = tFlashAssists / Math.max(roundsTotal, 1);
  const weakFlash = perRound < 0.8;

  return (
    <section>
      <SectionHeader
        title="道具分析"
        en="UTILITY"
        action={
          <div className="flex items-center gap-3">
            {(
              [
                ["all", "双方"],
                ["T", "T"],
                ["CT", "CT"],
              ] as [SideTab, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setSide(v)}
                className={cn(
                  "font-mono text-[11px] transition-colors duration-200",
                  side === v
                    ? v === "T"
                      ? "text-t-side"
                      : v === "CT"
                        ? "text-ct-side"
                        : "text-ink-1"
                    : "text-ink-3 hover:text-ink-2",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 divide-x divide-line/60 md:grid-cols-4">
        <UtilityStat
          label="闪光"
          en="FLASH"
          dot="#E9EFEA"
          value={flashes}
          sub={`助攻 ${flashAssists} · 场均致盲 ${avgBlind.toFixed(1)}s`}
        />
        <UtilityStat
          label="烟雾"
          en="SMOKE"
          dot="#4DA3FF"
          value={smokes}
          sub={`人均 ${(smokes / Math.max(filtered.length, 1)).toFixed(1)} 次 · 最多 ${topSmoke?.player ?? "—"} ×${topSmoke?.smokes ?? 0}`}
        />
        <UtilityStat
          label="燃烧"
          en="MOLOTOV"
          dot="#FFB020"
          value={molotovs}
          sub={`估算伤害 ${moloDmg} · 人均 ${(molotovs / Math.max(filtered.length, 1)).toFixed(1)} 次`}
        />
        <UtilityStat
          label="手雷"
          en="HE"
          dot="#FF5252"
          value={hes}
          sub={`估算伤害 ${heDmg} · 最多 ${topHe?.player ?? "—"} ×${topHe?.hes ?? 0}`}
        />
      </div>

      <CoachNote className="mt-8 max-w-lg" tilt="left">
        {weakFlash
          ? `! ${teamT} 的闪光助攻只有 ${perRound.toFixed(1)} 次/回合。进点之前，先学会要闪。`
          : `→ ${teamT} 场均 ${perRound.toFixed(1)} 次闪光助攻，进点道具纪律在线，继续保持。`}
      </CoachNote>
    </section>
  );
}
