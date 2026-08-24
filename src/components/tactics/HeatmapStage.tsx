// V2 地图舞台（design-v2/tactics.md §1.1）：本页唯一 HudFrame
// Canvas 热力层（death 红 / kill 蓝绿 径向渐变，mix-blend-screen）
// 密度 top-3 弱呼吸脉冲（±10% / 3s）；首杀散点；道具菱形+落点+虚线弧
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import SectionHeader from "@/components/board/SectionHeader";
import HudFrame from "@/components/board/HudFrame";
import { StaticUnderline } from "@/components/board/Mark";
import { mapImage } from "./zones";
import type { HeatPoint } from "@contracts/analysis";

export type LayerMode = "death" | "kill" | "firstkill" | "utility";
export type SideMode = "all" | "T" | "CT";

const KIND_COLOR: Record<LayerMode, string> = {
  death: "#FF5252",
  kill: "#3DDC84",
  firstkill: "#FFC94D",
  utility: "#B26BFF",
};

const LAYER_TABS: [LayerMode, string][] = [
  ["death", "死亡分布"],
  ["kill", "击杀分布"],
  ["firstkill", "首杀热点"],
  ["utility", "道具投掷"],
];

const LEGEND: Record<LayerMode, string> = {
  death: "死亡位置 · 密度越高越亮",
  kill: "击杀位置 · 密度越高越亮",
  firstkill: "首杀发生点 · 描边为所属阵营",
  utility: "菱形 = 投掷起点 · 圆点 = 落点",
};

interface HeatmapStageProps {
  mapName: string;
  displayMap: string;
  points: HeatPoint[]; // 已按读数面板筛选（全体/我方/对方/你）
  roundsTotal: number;
  mode: LayerMode;
  onModeChange: (m: LayerMode) => void;
  side: SideMode;
  onSideChange: (s: SideMode) => void;
  range: [number, number];
  onRangeChange: (r: [number, number]) => void;
}

export default function HeatmapStage({
  mapName,
  displayMap,
  points,
  roundsTotal,
  mode,
  onModeChange,
  side,
  onSideChange,
  range,
  onRangeChange,
}: HeatmapStageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const crossV = useRef<HTMLDivElement>(null);
  const crossH = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  const [popover, setPopover] = useState<{ p: HeatPoint; x: number; y: number } | null>(null);

  // 当前图层的点位（模式 + 阵营 + 回合范围）
  const layerPoints = useMemo(
    () =>
      points.filter(
        (p) =>
          p.kind === mode &&
          (side === "all" || p.side === side) &&
          (p.round === undefined || (p.round >= range[0] && p.round <= range[1])),
      ),
    [points, mode, side, range],
  );

  // 尺寸监听
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ob = new ResizeObserver(() => setSize(el.clientWidth));
    ob.observe(el);
    setSize(el.clientWidth);
    return () => ob.disconnect();
  }, []);

  // Canvas 绘制（含 top-3 呼吸脉冲的 rAF 循环）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 网格密度统计 → 点半径与呼吸点选取
    const GRID = 24;
    const bins = new Map<number, number>();
    layerPoints.forEach((p) => {
      const gx = Math.min(GRID - 1, Math.floor(p.x * GRID));
      const gy = Math.min(GRID - 1, Math.floor(p.y * GRID));
      const k = gy * GRID + gx;
      bins.set(k, (bins.get(k) ?? 0) + 1);
    });
    const maxBin = Math.max(1, ...bins.values());
    const topBins = [...bins.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => ({ x: ((k % GRID) + 0.5) / GRID, y: (Math.floor(k / GRID) + 0.5) / GRID }));

    const isHeat = mode === "death" || mode === "kill";
    const color = KIND_COLOR[mode];
    let raf = 0;

    const densityAt = (p: HeatPoint) => {
      const gx = Math.min(GRID - 1, Math.floor(p.x * GRID));
      const gy = Math.min(GRID - 1, Math.floor(p.y * GRID));
      return (bins.get(gy * GRID + gx) ?? 1) / maxBin;
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      if (isHeat) {
        ctx.globalCompositeOperation = "lighter";
        layerPoints.forEach((p) => {
          const d = densityAt(p);
          const r = size * (0.016 + d * 0.038);
          const g = ctx.createRadialGradient(p.x * size, p.y * size, 0, p.x * size, p.y * size, r);
          g.addColorStop(0, color + "B8");
          g.addColorStop(0.5, color + "55");
          g.addColorStop(1, color + "00");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x * size, p.y * size, r, 0, Math.PI * 2);
          ctx.fill();
        });
        // 密度最高的 3 个区域：3s 弱呼吸脉冲（半径 ±10%）
        topBins.forEach((b, i) => {
          const pulse = 1 + 0.1 * Math.sin((now / 3000) * Math.PI * 2 + i);
          const r = size * 0.05 * pulse;
          const g = ctx.createRadialGradient(b.x * size, b.y * size, 0, b.x * size, b.y * size, r);
          g.addColorStop(0, color + "30");
          g.addColorStop(1, color + "00");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(b.x * size, b.y * size, r, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalCompositeOperation = "source-over";
      } else if (mode === "firstkill") {
        // 首杀散点：12px 圆，阵营描边 + 中心白点
        layerPoints.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * size, p.y * size, 6, 0, Math.PI * 2);
          ctx.strokeStyle = p.side === "CT" ? "#4DA3FF" : "#FFB020";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.x * size, p.y * size, 2, 0, Math.PI * 2);
          ctx.fillStyle = "#E9EFEA";
          ctx.fill();
        });
      } else {
        // 道具：投掷起点菱形 + 落点圆 + 虚线弧
        layerPoints.forEach((p, i) => {
          const angle = (i * 2.399) % (Math.PI * 2);
          const ex = Math.min(0.98, Math.max(0.02, p.x + Math.cos(angle) * 0.055));
          const ey = Math.min(0.98, Math.max(0.02, p.y + Math.sin(angle) * 0.055));
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = color + "99";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x * size, p.y * size);
          ctx.quadraticCurveTo(
            ((p.x + ex) / 2) * size,
            (Math.min(p.y, ey) - 0.04) * size,
            ex * size,
            ey * size,
          );
          ctx.stroke();
          ctx.setLineDash([]);
          // 起点菱形
          const s = 4.5;
          ctx.beginPath();
          ctx.moveTo(p.x * size, p.y * size - s);
          ctx.lineTo(p.x * size + s, p.y * size);
          ctx.lineTo(p.x * size, p.y * size + s);
          ctx.lineTo(p.x * size - s, p.y * size);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
          // 落点圆
          ctx.beginPath();
          ctx.arc(ex * size, ey * size, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [layerPoints, mode, size]);

  // 十字准星光标（直接操作 DOM，透明度 0.12）
  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (crossV.current) crossV.current.style.transform = `translateX(${x}px)`;
    if (crossH.current) crossH.current.style.transform = `translateY(${y}px)`;
  };

  const onClick = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    if (mode === "death" || mode === "kill") {
      setPopover(null);
      return;
    }
    let best: HeatPoint | null = null;
    let bestD = 0.045;
    layerPoints.forEach((p) => {
      const d = Math.hypot(p.x - nx, p.y - ny);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    });
    setPopover(best ? { p: best, x: nx, y: ny } : null);
  };

  return (
    <section>
      <SectionHeader
        title="地图分析"
        en={`MAP — ${displayMap.toUpperCase()}`}
        className="mb-4"
        action={
          <div className="flex flex-wrap items-center gap-4">
            {/* 图层 Tabs：激活 = volt 静态手绘下划线 */}
            <div className="flex items-center gap-3.5">
              {LAYER_TABS.map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => onModeChange(v)}
                  className={cn(
                    "relative font-mono text-[11px] transition-colors duration-200",
                    mode === v ? "text-ink-1" : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  {label}
                  {mode === v && <StaticUnderline />}
                </button>
              ))}
            </div>
            {/* 阵营切换 */}
            <div className="flex items-center gap-3 border-l border-line pl-4">
              {(
                [
                  ["all", "双方"],
                  ["T", "T"],
                  ["CT", "CT"],
                ] as [SideMode, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => onSideChange(v)}
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
          </div>
        }
      />

      <HudFrame>
        <div className="mx-auto max-w-[600px]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            ref={wrapRef}
            onMouseMove={onMove}
            onClick={onClick}
            className="relative aspect-square w-full cursor-crosshair overflow-hidden rounded-sm"
          >
            <img
              src={mapImage(mapName)}
              alt={displayMap}
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
            <div className="absolute inset-0 bg-board-0/45" />
            {/* 热力层：图层切换 0.25s 交叉淡入 */}
            <motion.canvas
              key={mode}
              ref={canvasRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                mixBlendMode: "screen",
              }}
            />
            {/* 十字准星跟随（opacity 0.12） */}
            <div
              ref={crossV}
              className="pointer-events-none absolute inset-y-0 left-0 w-px bg-ink-1 opacity-[0.12]"
            />
            <div
              ref={crossH}
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-ink-1 opacity-[0.12]"
            />

            {/* 左上角小图例（随模式切换） */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 bg-board-0/60 px-2 py-1 text-[10px] text-ink-3">
              <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[mode] }} />
              {LEGEND[mode]}
            </div>

            {/* 点击 popover（首杀/道具点位） */}
            {popover && (
              <div
                className="absolute z-20 w-48 -translate-x-1/2 rounded-sm border border-line-strong bg-board-3 p-3"
                style={{
                  left: `${Math.min(82, Math.max(18, popover.x * 100))}%`,
                  top: `${Math.min(78, Math.max(10, popover.y * 100))}%`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="absolute right-1.5 top-1.5 text-ink-3 hover:text-ink-1"
                  onClick={() => setPopover(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <p className="font-mono text-[11px] font-bold text-ink-1">
                  {popover.p.round ? `R${popover.p.round} · ` : ""}
                  {popover.p.player ?? "未知选手"}
                </p>
                <p className="mt-1 text-[11px] text-ink-3">
                  {popover.p.kind === "firstkill" ? "首杀热点" : "道具投掷"} ·{" "}
                  {popover.p.side === "T" ? "T 方" : popover.p.side === "CT" ? "CT 方" : ""}
                </p>
              </div>
            )}
          </motion.div>

          {/* 回合范围滑杆 */}
          <div className="mt-4 flex items-center gap-4">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              回合范围
            </span>
            <Slider
              min={1}
              max={Math.max(roundsTotal, 2)}
              step={1}
              value={[range[0], range[1]]}
              onValueChange={(v) => onRangeChange([v[0] ?? 1, v[1] ?? roundsTotal])}
              className="flex-1"
            />
            <span className="shrink-0 font-mono text-xs tabular-nums text-ink-2">
              R{range[0]}–R{range[1]}
            </span>
          </div>
        </div>
      </HudFrame>
    </section>
  );
}
