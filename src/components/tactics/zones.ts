// 战术页共享：归一化坐标 → 地图区域划分。
// 区域按地图配置；坐标与官方雷达图对齐（y 已翻转），
// Mirage：A 区在右上、B 区在左上、中路纵贯中部。
import type { HeatPoint } from "@contracts/analysis";

export interface Zone {
  id: string;
  label: string;
  test: (x: number, y: number) => boolean;
}

/** Mirage 区域（顺序敏感：先包点、后中路、再两翼） */
const MIRAGE_ZONES: Zone[] = [
  { id: "asite", label: "A 区", test: (x, y) => x > 0.6 && y < 0.42 },
  { id: "bsite", label: "B 区", test: (x, y) => x < 0.4 && y < 0.42 },
  { id: "mid", label: "中路", test: (x, y) => x >= 0.4 && x <= 0.64 && y >= 0.36 && y < 0.66 },
  { id: "aramp", label: "A1/拱门", test: (x, y) => x >= 0.4 && y >= 0.66 },
  { id: "bshort", label: "B 小/中路下", test: () => true },
];

const ZONE_BY_MAP: Record<string, Zone[]> = {
  de_mirage: MIRAGE_ZONES,
  Mirage: MIRAGE_ZONES,
};

/** 该地图的区域配置；无配置返回 undefined（调用方应隐藏区域读数） */
export function zonesForMap(mapName: string): Zone[] | undefined {
  return ZONE_BY_MAP[mapName];
}

/** @deprecated 兼容旧调用，仅限 Mirage；新代码用 zonesForMap */
export const ZONES: Zone[] = MIRAGE_ZONES;

export function classifyZone(x: number, y: number): Zone {
  return ZONES.find((z) => z.test(x, y)) ?? ZONES[ZONES.length - 1];
}

export function zoneCounts(
  points: HeatPoint[],
  zones?: Zone[],
): Map<string, number> {
  const m = new Map<string, number>();
  const list = zones ?? MIRAGE_ZONES;
  points.forEach((p) => {
    const z = list.find((zz) => zz.test(p.x, p.y)) ?? list[list.length - 1];
    m.set(z.id, (m.get(z.id) ?? 0) + 1);
  });
  return m;
}

export function mapImage(mapName: string): string {
  return `/map-${mapName.replace(/^de_/, "")}.png`;
}
