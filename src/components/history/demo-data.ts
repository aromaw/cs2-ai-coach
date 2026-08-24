// 历史页演示数据：12 场示例对局（history.md §4 模拟数据约定）。
// 第 1 场（内置示例 Mirage 13:9 NOVA vs AETHER）的个人数据从 MOCK_MATCH 主角
// 玩家 s1mple丶Fan 派生，其余 11 场为静态演示数据。所有条目 demo=true，
// 页面上标注「示例数据」；负 id 一律跳转 /match/demo。
import { MOCK_MATCH } from "@/lib/mock-match";
import type { MatchSummary } from "@contracts/analysis";

/** 单场对局中主角玩家（"你"）的个人指标 */
export interface HistoryStats {
  kills: number;
  deaths: number;
  adr: number;
  rating: number;
  kast: number; // 0-100
  hsPercent: number; // 0-100
}

export interface HistoryEntry {
  match: MatchSummary;
  /** 真实上传的对局暂无摘要级个人数据，可能缺省 */
  stats?: HistoryStats;
  /** true = 本地演示数据 */
  demo: boolean;
}

const hero =
  MOCK_MATCH.players.find((p) => p.name === "s1mple丶Fan") ?? MOCK_MATCH.players[0];

const heroStats: HistoryStats = {
  kills: hero.kills,
  deaths: hero.deaths,
  adr: hero.adr,
  rating: hero.rating,
  kast: hero.kast,
  hsPercent: hero.hsPercent,
};

function demo(
  key: number,
  mapName: string,
  displayMap: string,
  opponent: string,
  scoreT: number,
  scoreCT: number,
  playedAt: string,
  stats: HistoryStats,
): HistoryEntry {
  return {
    demo: true,
    match: {
      id: -key, // 负 id → 路由 /match/demo
      mapName,
      displayMap,
      teamTName: "NOVA", // 主角所在队（T 开局）
      teamCTName: opponent,
      scoreT,
      scoreCT,
      roundsTotal: scoreT + scoreCT,
      source: "demo",
      playedAt,
    },
    stats,
  };
}

function s(
  kills: number,
  deaths: number,
  adr: number,
  rating: number,
  kast: number,
  hsPercent: number,
): HistoryStats {
  return { kills, deaths, adr, rating, kast, hsPercent };
}

/**
 * 近 30 天 12 场示例对局（新→旧）。
 * 地图分布 Mirage×5 / Inferno×3 / Nuke×2 / Ancient×1 / Dust2×1；
 * 战绩 7W-5L；Rating 范围 0.82–1.34。
 */
export const DEMO_HISTORY: HistoryEntry[] = [
  demo(1, "de_mirage", "Mirage", "AETHER", 13, 9, "2026-08-22T14:30:00.000Z", heroStats),
  demo(2, "de_mirage", "Mirage", "HELIX", 10, 13, "2026-08-19T20:05:00.000Z", s(18, 20, 71.8, 0.94, 63.2, 31.4)),
  demo(3, "de_inferno", "Inferno", "PULSE", 13, 11, "2026-08-16T21:40:00.000Z", s(26, 19, 95.2, 1.21, 74.1, 40.3)),
  demo(4, "de_nuke", "Nuke", "AETHER", 8, 13, "2026-08-12T19:22:00.000Z", s(13, 18, 62.5, 0.82, 58.0, 28.6)),
  demo(5, "de_mirage", "Mirage", "ORBIT", 13, 7, "2026-08-09T22:11:00.000Z", s(27, 13, 104.6, 1.34, 78.9, 44.2)),
  demo(6, "de_inferno", "Inferno", "HELIX", 11, 13, "2026-08-06T20:48:00.000Z", s(19, 21, 76.3, 0.97, 66.7, 33.8)),
  demo(7, "de_ancient", "Ancient", "PULSE", 13, 10, "2026-08-03T21:03:00.000Z", s(22, 17, 88.9, 1.12, 71.4, 38.5)),
  demo(8, "de_mirage", "Mirage", "VORTEX", 13, 6, "2026-07-31T20:36:00.000Z", s(24, 14, 92.7, 1.18, 73.9, 41.0)),
  demo(9, "de_nuke", "Nuke", "ORBIT", 9, 13, "2026-07-29T19:57:00.000Z", s(15, 19, 68.4, 0.89, 61.5, 30.2)),
  demo(10, "de_inferno", "Inferno", "VORTEX", 13, 9, "2026-07-27T21:26:00.000Z", s(21, 17, 84.1, 1.05, 69.6, 35.7)),
  demo(11, "de_dust2", "Dust2", "AETHER", 11, 13, "2026-07-25T20:14:00.000Z", s(20, 19, 80.3, 1.02, 68.0, 34.1)),
  demo(12, "de_mirage", "Mirage", "HELIX", 13, 8, "2026-07-24T21:52:00.000Z", s(23, 15, 90.8, 1.15, 72.7, 39.4)),
];

/** 地图显示名 → 缩略图资源（/public/map-<short>.png） */
export function mapThumb(displayMap: string): string {
  return `/map-${displayMap.toLowerCase()}.png`;
}

/** 从主角视角（teamTName 为主角队）判定胜负 */
export function isWin(m: MatchSummary): boolean {
  return m.scoreT > m.scoreCT;
}

/** Rating 着色规则（与记分板一致）：≥1.10 success / 0.90–1.10 text-1 / <0.90 danger */
export function ratingColorClass(rating?: number): string {
  if (rating === undefined) return "text-text-3";
  if (rating >= 1.1) return "text-success";
  if (rating >= 0.9) return "text-text-1";
  return "text-danger";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO → `2026.08.22 14:30` */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO → `08.22`（图表 X 轴缩写） */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** 由回合数估算时长（MR12，含中场与技术暂停的粗略估计） */
export function estMinutes(roundsTotal: number): number {
  return Math.round(roundsTotal * 1.75 + 10);
}

/** 负 id（内置示例 / 演示数据）→ /match/demo；真实记录 → /match/:id */
export function matchPath(id: number): string {
  return id < 0 ? "/match/demo" : `/match/${id}`;
}
