// 选手分析页 / 教练页共享的纯函数工具：全部从 AnalysisResult 数据推导，无硬编码统计。
import { useEffect, useRef, useState } from "react";
import type {
  AnalysisResult,
  CoachAdvice,
  PlayerStat,
  RoundSummary,
} from "@contracts/analysis";

/** 稳定头像：按名字哈希映射到 /avatar-1.png … /avatar-10.png */
export function avatarFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return `/avatar-${(h % 10) + 1}.png`;
}

/** 默认主角：pid 为 "me" 或无法匹配时，选 rating 最高的 T 方（开局）玩家 */
export function pickDefaultPlayer(players: PlayerStat[]): PlayerStat | undefined {
  const tSide = players.filter((p) => p.startSide === "T");
  const pool = tSide.length > 0 ? tSide : players;
  return pool.reduce<PlayerStat | undefined>(
    (best, p) => (best === undefined || p.rating > best.rating ? p : best),
    undefined,
  );
}

/** 解析选中的选手：按 name 匹配 pid，失败回退上传者指定的主角（再回退默认） */
export function resolvePlayer(
  players: PlayerStat[],
  pid: string | undefined,
  heroName?: string,
): { player: PlayerStat | undefined; isDefault: boolean } {
  const fallback =
    (heroName ? players.find((p) => p.name === heroName) : undefined) ??
    pickDefaultPlayer(players);
  if (!pid || pid === "me") return { player: fallback, isDefault: true };
  const found = players.find((p) => p.name === pid);
  if (found) return { player: found, isDefault: found === fallback };
  return { player: fallback, isDefault: true };
}

/** 角色标签：从武器与行为数据推导 */
export function roleOf(player: PlayerStat, players: PlayerStat[]): string {
  const team = players.filter((p) => p.teamName === player.teamName);
  const awpKills = player.weaponKills["awp"] ?? 0;
  if (player.kills > 0 && awpKills / player.kills >= 0.3) return "主狙 AWP";
  const maxFk = Math.max(...team.map((p) => p.firstKills));
  if (player.firstKills >= maxFk && player.firstKills > 0) return "主突破 ENTRY";
  const maxFlash = Math.max(...team.map((p) => p.flashAssists));
  if (player.flashAssists >= maxFlash && player.flashAssists > 0) return "辅助 SUPPORT";
  return "步枪手 RIFLER";
}

/** 进入视口后一次性 count-up（V2 白名单动效） */
export function useCountUp(value: number, duration = 900) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    started.current = false;
    setDisplay(0);
    const ob = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const tick = () => {
            const p = Math.min(1, (performance.now() - t0) / duration);
            setDisplay(value * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [value, duration]);

  return { ref, display };
}

// ---------- 六维雷达（0-100，由原始指标归一化推导） ----------
// 维度顺序（player.md）：枪法 / 意识 / 首杀 / 残局 / 道具 / 经济

export interface RadarScore {
  key: string;
  label: string;
  short: string;
  value: number;
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function radarScores(p: PlayerStat): RadarScore[] {
  return [
    {
      key: "aim",
      label: "枪法 AIM",
      short: "枪法",
      value: clamp100((p.adr / 110) * 60 + p.hsPercent * 0.4),
    },
    { key: "aware", label: "意识 AWR", short: "意识", value: clamp100(p.kast) },
    {
      key: "entry",
      label: "首杀 ENTRY",
      short: "首杀",
      value: clamp100(p.openingDuelWinRate),
    },
    {
      key: "clutch",
      label: "残局 CLUTCH",
      short: "残局",
      value: p.clutchAttempts > 0 ? clamp100((p.clutchWins / p.clutchAttempts) * 100) : 0,
    },
    {
      key: "util",
      label: "道具 UTIL",
      short: "道具",
      value: clamp100(p.flashAssists * 10 + p.enemiesFlashed * 2 + p.utilityDamage / 8),
    },
    {
      key: "econ",
      label: "经济 ECON",
      short: "经济",
      value: clamp100(45 + (p.kd - 1) * 35 + p.mvps * 4),
    },
  ];
}

/** 同队平均雷达 */
export function teamRadarAvg(players: PlayerStat[], teamName: string): number[] {
  const team = players.filter((p) => p.teamName === teamName);
  const roster = team.length > 0 ? team : players;
  const all = roster.map(radarScores);
  if (all.length === 0) return [];
  return all[0].map(
    (_, i) => Math.round(all.reduce((s, sc) => s + sc[i].value, 0) / all.length),
  );
}

/** 自动判语：最强 / 最弱维度 */
export function radarVerdict(scores: RadarScore[]): string {
  const max = scores.reduce((a, b) => (b.value > a.value ? b : a));
  const min = scores.reduce((a, b) => (b.value < a.value ? b : a));
  return `※ ${max.short}（${max.value}）是最强武器，${min.short}（${min.value}）拖了后腿。`;
}

// ---------- 武器 ----------

const WEAPON_DISPLAY: Record<string, string> = {
  ak47: "AK-47",
  m4a1: "M4A1-S",
  m4a4: "M4A4",
  awp: "AWP",
  galilar: "Galil AR",
  famas: "FAMAS",
  usp_silencer: "USP-S",
  glock: "Glock-18",
  p250: "P250",
  deagle: "Desert Eagle",
  hegrenade: "HE 手雷",
  molotov: "燃烧瓶",
  inferno: "燃烧弹",
};

export function weaponLabel(key: string): string {
  return WEAPON_DISPLAY[key] ?? key.toUpperCase().replace(/_/g, " ");
}

export interface WeaponDatum {
  key: string;
  label: string;
  kills: number;
}

export function weaponDistribution(p: PlayerStat): WeaponDatum[] {
  return Object.entries(p.weaponKills)
    .map(([key, kills]) => ({ key, label: weaponLabel(key), kills }))
    .sort((a, b) => b.kills - a.kills);
}

// ---------- 对位击杀关系（从回合事件流推导） ----------

export interface MatchupEntry {
  name: string;
  count: number;
}

export function matchupCounts(
  rounds: RoundSummary[],
  name: string,
): { killed: MatchupEntry[]; killedBy: MatchupEntry[] } {
  const killed = new Map<string, number>();
  const killedBy = new Map<string, number>();
  for (const r of rounds) {
    for (const e of r.events) {
      if (e.type !== "kill") continue;
      if (e.actor === name && e.victim) {
        killed.set(e.victim, (killed.get(e.victim) ?? 0) + 1);
      }
      if (e.victim === name && e.actor) {
        killedBy.set(e.actor, (killedBy.get(e.actor) ?? 0) + 1);
      }
    }
  }
  const top = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([n, count]) => ({ name: n, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  return { killed: top(killed), killedBy: top(killedBy) };
}

// ---------- 教练建议辅助（V2 token：danger / warning / success） ----------

export const CATEGORY_META: Record<CoachAdvice["category"], { label: string }> = {
  aim: { label: "对枪习惯" },
  economy: { label: "经济管理" },
  utility: { label: "道具使用" },
  positioning: { label: "站位走位" },
  teamwork: { label: "团队协作" },
};

export const PRIORITY_META: Record<
  CoachAdvice["priority"],
  { label: string; short: string; dot: string; text: string; estimate: number }
> = {
  1: { label: "P1 高优先", short: "P1", dot: "bg-danger", text: "text-danger", estimate: 0.06 },
  2: { label: "P2 中优先", short: "P2", dot: "bg-warning", text: "text-warning", estimate: 0.03 },
  3: { label: "P3 常规", short: "P3", dot: "bg-success", text: "text-success", estimate: 0.02 },
};

export function sortAdvice(list: CoachAdvice[]): CoachAdvice[] {
  return [...list].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

/** 按预估提升空间排序（降序） */
export function sortAdviceByEstimate(list: CoachAdvice[]): CoachAdvice[] {
  return [...list].sort(
    (a, b) =>
      PRIORITY_META[b.priority].estimate - PRIORITY_META[a.priority].estimate ||
      a.id.localeCompare(b.id),
  );
}

/** 该玩家专属建议（按优先级） */
export function adviceForPlayer(data: AnalysisResult, name: string): CoachAdvice[] {
  return sortAdvice(data.coach.filter((a) => a.player === name));
}

/** 团队级建议（player 为空） */
export function teamAdvice(data: AnalysisResult): CoachAdvice[] {
  return sortAdvice(data.coach.filter((a) => !a.player));
}
