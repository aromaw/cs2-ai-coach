// RETAKE — CS2 Demo 分析结果共享类型（前端 ↔ 后端契约）

export type Side = "T" | "CT";

export interface PlayerStat {
  steamid: string;
  name: string;
  teamName: string;
  /** 开局阵营（可能半场换边） */
  startSide: Side;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  adr: number;
  kast: number; // 百分比 0-100
  hsPercent: number;
  firstKills: number;
  firstDeaths: number;
  openingDuelWinRate: number; // 0-100
  clutchAttempts: number;
  clutchWins: number;
  multiKillRounds: number; // 2杀及以上回合数
  mvps: number;
  score: number;
  rating: number; // Rating 2.0 风格估算
  flashAssists: number;
  enemiesFlashed: number;
  utilityDamage: number;
  /** 击杀武器分布 */
  weaponKills: Record<string, number>;
  /** 每回合击杀数（用于走势） */
  killsPerRound: number[];
}

export interface RoundSummary {
  round: number; // 1-based
  winner: Side;
  winReason: "elimination" | "bomb_exploded" | "bomb_defused" | "time" | "unknown";
  scoreT: number; // 该回合结束后比分
  scoreCT: number;
  durationSec: number;
  mvpName?: string;
  /** 双方该回合装备价值 */
  equipValueT: number;
  equipValueCT: number;
  buyTypeT: BuyType;
  buyTypeCT: BuyType;
  /** 关键事件流（击杀/安包/拆包等），用于时间线展开 */
  events: RoundEvent[];
  isKeyRound: boolean;
  keyReason?: string; // 手枪局/赛点/经济重置/翻盘
}

export type BuyType = "full_eco" | "semi" | "force" | "full_buy" | "unknown";

export interface RoundEvent {
  t: number; // 回合内秒
  type: "kill" | "plant" | "defuse" | "explode" | "flash" | "smoke" | "molotov" | "he";
  actor?: string;
  victim?: string;
  weapon?: string;
  headshot?: boolean;
  side?: Side;
}

export interface HeatPoint {
  /** 归一化到 0-1 的地图坐标 */
  x: number;
  y: number;
  kind: "death" | "kill" | "firstkill" | "utility";
  side?: Side;
  player?: string;
  round?: number;
}

export interface UtilityStats {
  player: string;
  flashes: number;
  smokes: number;
  molotovs: number;
  hes: number;
  flashAssists: number;
  enemiesFlashed: number;
  avgBlindDuration: number;
  utilityDamage: number;
}

export interface CoachAdvice {
  id: string;
  /** 针对的玩家名；缺省表示全队/团队级建议 */
  player?: string;
  category: "aim" | "economy" | "utility" | "positioning" | "teamwork";
  priority: 1 | 2 | 3; // 1 = 最严重
  title: string;
  description: string;
  evidence: { label: string; value: string; ref?: string }[];
  relatedRounds: number[];
}

export interface MatchInfo {
  id: number | string;
  mapName: string;
  displayMap: string; // Mirage 等
  teamTName: string;
  teamCTName: string;
  scoreT: number;
  scoreCT: number;
  roundsTotal: number;
  durationSec: number;
  playedAt: string; // ISO
  source: "upload" | "demo";
  fileName?: string;
}

export interface AnalysisResult {
  match: MatchInfo;
  players: PlayerStat[];
  rounds: RoundSummary[];
  heat: HeatPoint[];
  utility: UtilityStats[];
  coach: CoachAdvice[];
  /** 逐回合双方经济曲线 */
  economy: { round: number; valueT: number; valueCT: number }[];
}

export interface MatchSummary {
  id: number;
  mapName: string;
  displayMap: string;
  teamTName: string;
  teamCTName: string;
  scoreT: number;
  scoreCT: number;
  roundsTotal: number;
  playedAt: string;
  source: string;
}

/** 地图名 → 显示名 */
export const MAP_DISPLAY: Record<string, string> = {
  de_mirage: "Mirage",
  de_inferno: "Inferno",
  de_nuke: "Nuke",
  de_ancient: "Ancient",
  de_anubis: "Anubis",
  de_dust2: "Dust2",
  de_vertigo: "Vertigo",
  de_overpass: "Overpass",
  de_train: "Train",
};

/** 地图雷达校准参数（世界坐标 → 1024px 俯视图） */
export const MAP_CALIBRATION: Record<
  string,
  { posX: number; posY: number; scale: number }
> = {
  de_mirage: { posX: -3230, posY: 1713, scale: 5.0 },
  de_inferno: { posX: -2087, posY: 3870, scale: 4.9 },
  de_nuke: { posX: -3453, posY: 2887, scale: 7.0 },
  de_ancient: { posX: -2953, posY: 2164, scale: 5.0 },
  de_anubis: { posX: -2796, posY: 3328, scale: 5.22 },
  de_dust2: { posX: -2476, posY: 3239, scale: 4.4 },
  de_vertigo: { posX: -3168, posY: 1762, scale: 4.0 },
  de_overpass: { posX: -4831, posY: 1781, scale: 5.2 },
  de_train: { posX: -2477, posY: 2392, scale: 4.7 },
};
