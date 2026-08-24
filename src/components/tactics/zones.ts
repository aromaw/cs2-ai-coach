// 战术页共享：归一化坐标 → 地图区域的固定划分（近似 Mirage 雷达布局）
import type { HeatPoint } from "@contracts/analysis";

export interface Zone {
  id: string;
  label: string;
  test: (x: number, y: number) => boolean;
}

/** 区域判定顺序敏感：先包点、后中路、再两翼 */
export const ZONES: Zone[] = [
  { id: "asite", label: "A 区", test: (x, y) => x < 0.44 && y < 0.36 },
  { id: "bsite", label: "B 区", test: (x, y) => x > 0.62 && y < 0.4 },
  { id: "mid", label: "中路", test: (x, y) => x >= 0.4 && x <= 0.64 && y >= 0.36 && y < 0.62 },
  { id: "aramp", label: "A1/A2 楼", test: (x, y) => x < 0.48 && y >= 0.36 },
  { id: "bshort", label: "B 小/下水道", test: () => true },
];

export function classifyZone(x: number, y: number): Zone {
  return ZONES.find((z) => z.test(x, y)) ?? ZONES[ZONES.length - 1];
}

export function zoneCounts(points: HeatPoint[]): Map<string, number> {
  const m = new Map<string, number>();
  points.forEach((p) => {
    const z = classifyZone(p.x, p.y);
    m.set(z.id, (m.get(z.id) ?? 0) + 1);
  });
  return m;
}

export function mapImage(mapName: string): string {
  return `/map-${mapName.replace(/^de_/, "")}.png`;
}
