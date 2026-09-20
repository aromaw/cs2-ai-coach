// 近期趋势：扫描本地存储的最近 N 场比赛，按玩家聚合指标走势、
// 坏习惯证据频率，并生成"需要保持 / 需要改变"的结论。
import fsp from "fs/promises";
import path from "path";
import type { AnalysisResult, EvidenceItem } from "../../contracts/analysis";

const DATA_DIR = path.resolve(process.cwd(), "data", "retake-matches");

export interface TrendPoint {
  matchId: number;
  map: string;
  playedAt: string;
  scoreT: number;
  scoreCT: number;
  kills: number;
  deaths: number;
  adr: number;
  kast: number;
  hsPercent: number;
  firstKills: number;
  firstDeaths: number;
  openingDuelWinRate: number;
  tradeKills: number;
  tradedDeaths: number;
  clutchAttempts: number;
  clutchWins: number;
  rating: number;
  kd: number;
  flashAssists: number;
  enemiesFlashed: number;
  utilityDamage: number;
  mvps: number;
  postPlantSurvivalRate: number | null;
}

export interface TrendDirection {
  metric: string;
  label: string;
  first: number;
  last: number;
  delta: number;
  trend: "up" | "down" | "flat";
  note: string;
}

export interface PlayerTrend {
  playerName: string;
  steamid: string;
  matches: TrendPoint[];
  directions: TrendDirection[];
  evidenceAgg: {
    issue: string;
    label: string;
    count: number;
    matchCount: number;
  }[];
  keep: string[];
  change: string[];
}

export interface RosterEntry {
  steamid: string;
  name: string;
  lastPlayedAt: string;
  matchCount: number;
}

interface StoredMatch {
  id: number;
  analysis: AnalysisResult;
}

async function readStoredMatches(): Promise<StoredMatch[]> {
  const files = await fsp.readdir(DATA_DIR).catch(() => [] as string[]);
  const out: StoredMatch[] = [];
  for (const file of files) {
    const m = file.match(/^(\d+)\.json$/);
    if (!m) continue;
    try {
      const analysis = JSON.parse(
        await fsp.readFile(path.join(DATA_DIR, file), "utf8"),
      ) as AnalysisResult;
      out.push({ id: Number(m[1]), analysis });
    } catch {
      // 跳过损坏存档
    }
  }
  out.sort(
    (a, b) => a.analysis.match.playedAt.localeCompare(b.analysis.match.playedAt),
  );
  return out;
}

/** 所有存档比赛中出现过的玩家（用于趋势页选择器） */
export async function listRoster(): Promise<RosterEntry[]> {
  const matches = await readStoredMatches();
  const bySteam = new Map<string, RosterEntry>();
  for (const { analysis } of matches) {
    for (const p of analysis.players) {
      const cur = bySteam.get(p.steamid);
      if (!cur) {
        bySteam.set(p.steamid, {
          steamid: p.steamid,
          name: p.name,
          lastPlayedAt: analysis.match.playedAt,
          matchCount: 1,
        });
      } else {
        cur.matchCount += 1;
        if (analysis.match.playedAt > cur.lastPlayedAt) {
          cur.lastPlayedAt = analysis.match.playedAt;
          cur.name = p.name;
        }
      }
    }
  }
  return [...bySteam.values()].sort((a, b) =>
    b.lastPlayedAt.localeCompare(a.lastPlayedAt),
  );
}

const METRICS: {
  key: keyof TrendPoint;
  label: string;
  digits: number;
  betterHigh: boolean;
}[] = [
  { key: "adr", label: "ADR", digits: 1, betterHigh: true },
  { key: "rating", label: "Rating", digits: 2, betterHigh: true },
  { key: "kast", label: "KAST%", digits: 1, betterHigh: true },
  { key: "hsPercent", label: "爆头率%", digits: 1, betterHigh: true },
  { key: "openingDuelWinRate", label: "首杀胜率%", digits: 1, betterHigh: true },
  { key: "kd", label: "K/D", digits: 2, betterHigh: true },
  { key: "firstKills", label: "首杀数", digits: 0, betterHigh: true },
  { key: "tradeKills", label: "补枪数", digits: 0, betterHigh: true },
  { key: "flashAssists", label: "闪光助攻", digits: 0, betterHigh: true },
  { key: "utilityDamage", label: "道具伤害", digits: 0, betterHigh: true },
];

function trendNote(
  label: string,
  first: number,
  last: number,
  trend: "up" | "down" | "flat",
  betterHigh: boolean,
): string {
  const good = (trend === "up") === betterHigh;
  const arrow = trend === "up" ? "上升" : trend === "down" ? "下滑" : "稳定";
  const meaning =
    trend === "flat"
      ? "状态平稳"
      : good
        ? "这是好的走向，继续强化"
        : "需要重点关注，建议针对性训练";
  return `${label} ${arrow}：${first} → ${last}。${meaning}。`;
}

export async function buildPlayerTrend(
  steamid: string,
  limit = 5,
): Promise<PlayerTrend | null> {
  const matches = (await readStoredMatches())
    .map(({ id, analysis }) => {
      const player = analysis.players.find((p) => p.steamid === steamid);
      return player ? { id, analysis, player } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(-limit);

  if (!matches.length) return null;

  const points: TrendPoint[] = matches.map(({ id, analysis, player }) => {
    const postRate =
      player.postPlantRounds > 0
        ? Math.round((player.postPlantSurvivalRounds / player.postPlantRounds) * 100)
        : null;
    return {
      matchId: id,
      map: analysis.match.displayMap,
      playedAt: analysis.match.playedAt,
      scoreT: analysis.match.scoreT,
      scoreCT: analysis.match.scoreCT,
      kills: player.kills,
      deaths: player.deaths,
      adr: player.adr,
      kast: player.kast,
      hsPercent: player.hsPercent,
      firstKills: player.firstKills,
      firstDeaths: player.firstDeaths,
      openingDuelWinRate: player.openingDuelWinRate,
      tradeKills: player.tradeKills,
      tradedDeaths: player.tradedDeaths,
      clutchAttempts: player.clutchAttempts,
      clutchWins: player.clutchWins,
      rating: player.rating,
      kd: player.kd,
      flashAssists: player.flashAssists,
      enemiesFlashed: player.enemiesFlashed,
      utilityDamage: player.utilityDamage,
      mvps: player.mvps,
      postPlantSurvivalRate: postRate,
    };
  });

  // 趋势：前 2 场 vs 后 2 场（不足则首末场）
  const headN = Math.min(2, Math.floor(points.length / 2) || 1);
  const head = points.slice(0, headN);
  const tail = points.slice(-headN);
  const avg = (list: TrendPoint[], key: keyof TrendPoint) =>
    list.reduce((a, p) => a + (p[key] as number), 0) / list.length;

  const directions: TrendDirection[] = [];
  for (const m of METRICS) {
    const first = avg(head, m.key);
    const last = avg(tail, m.key);
    const delta = last - first;
    const tolerance = Math.max(2, Math.abs(first) * 0.07);
    const trend: TrendDirection["trend"] =
      delta > tolerance ? "up" : delta < -tolerance ? "down" : "flat";
    if (points.length < 3 && trend === "flat") continue;
    directions.push({
      metric: m.key as string,
      label: m.label,
      first: Number(first.toFixed(m.digits)),
      last: Number(last.toFixed(m.digits)),
      delta: Number(delta.toFixed(m.digits)),
      trend,
      note: trendNote(m.label, Number(first.toFixed(m.digits)), Number(last.toFixed(m.digits)), trend, m.betterHigh),
    });
  }

  // 证据聚合（跨场次）
  const evAgg = new Map<string, { label: string; count: number; matchIds: Set<number> }>();
  for (const { id, analysis } of matches) {
    const evs: EvidenceItem[] = (analysis.evidence ?? []).filter(
      (e) => e.playerId === steamid,
    );
    for (const e of evs) {
      const cur = evAgg.get(e.issue) ?? {
        label: e.label,
        count: 0,
        matchIds: new Set<number>(),
      };
      cur.count += 1;
      cur.matchIds.add(id);
      evAgg.set(e.issue, cur);
    }
  }
  const evidenceAgg = [...evAgg.entries()]
    .map(([issue, v]) => ({
      issue,
      label: v.label,
      count: v.count,
      matchCount: v.matchIds.size,
    }))
    .sort((a, b) => b.count - a.count || b.matchCount - a.matchCount);

  // keep / change
  const change: string[] = [];
  for (const d of directions) {
    if (d.trend === "down") change.push(d.note);
    if (change.length >= 3) break;
  }
  for (const ev of evidenceAgg) {
    if (change.length >= 5) break;
    if (ev.count >= 2 || ev.matchCount >= 2) {
      change.push(
        `「${ev.label}」在 ${ev.matchCount} 场比赛中出现了 ${ev.count} 次——这是当前最明确的瓶颈，优先处理。`,
      );
    }
  }
  if (!change.length && evidenceAgg.length) {
    const ev = evidenceAgg[0];
    change.push(
      `「${ev.label}」出现过 ${ev.count} 次（${ev.matchCount} 场），留意是否发展为固定习惯。`,
    );
  }

  const keep: string[] = [];
  for (const d of directions) {
    if (keep.length >= 3) break;
    if (d.trend === "up") keep.push(d.note);
  }
  const lastRating = points[points.length - 1].rating;
  if (!keep.length || lastRating >= 1.05) {
    keep.push(
      `Rating 近期 ${points.map((p) => p.rating.toFixed(2)).join(" → ")}，${
        lastRating >= 1.05 ? "整体状态在线，保持当前训练节奏。" : "基本盘稳定，不必大幅调整打法。"
      }`,
    );
  }
  const upCount = directions.filter((d) => d.trend === "up").length;
  const flatCount = directions.filter((d) => d.trend === "flat").length;
  if (upCount + flatCount >= directions.length - 1 && directions.length > 2) {
    keep.push("绝大多数指标稳定或上行——近期不需要结构性改变，重点是把已验证的打法执行得更一致。");
  }

  return {
    playerName: matches[matches.length - 1].player.name,
    steamid,
    matches: points,
    directions,
    evidenceAgg: evidenceAgg.slice(0, 8),
    keep: keep.slice(0, 4),
    change: change.slice(0, 5),
  };
}
