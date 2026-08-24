// Overview 页派生数据：所有统计均从 AnalysisResult 计算，不硬编码。
import type { AnalysisResult, PlayerStat, RoundSummary, Side } from "@contracts/analysis";

/** 半场分界回合数（MR12 → 12） */
export function halfSize(rounds: RoundSummary[]): number {
  return Math.ceil(rounds.length / 2);
}

export interface HalfPlayerStat {
  kills: number;
  deaths: number;
  hsKills: number;
  firstKills: number;
}

/** 从回合事件流推导某半场每个选手的可推导指标（K / D / HS / 首杀） */
export function computeHalfStats(
  rounds: RoundSummary[],
  half: 1 | 2,
): Map<string, HalfPlayerStat> {
  const halfAt = halfSize(rounds);
  const slice = rounds.filter((r) =>
    half === 1 ? r.round <= halfAt : r.round > halfAt,
  );
  const map = new Map<string, HalfPlayerStat>();
  const get = (name: string): HalfPlayerStat => {
    let s = map.get(name);
    if (!s) {
      s = { kills: 0, deaths: 0, hsKills: 0, firstKills: 0 };
      map.set(name, s);
    }
    return s;
  };
  for (const r of slice) {
    const kills = r.events
      .filter((e) => e.type === "kill" && e.actor && e.victim)
      .sort((a, b) => a.t - b.t);
    kills.forEach((e, i) => {
      const a = get(e.actor!);
      a.kills++;
      if (e.headshot) a.hsKills++;
      if (i === 0) a.firstKills++;
      get(e.victim!).deaths++;
    });
  }
  return map;
}

export interface HalfScore {
  t: number;
  ct: number;
}

/** 某半场双方（按开局阵营）得分 */
export function computeHalfScore(rounds: RoundSummary[], half: 1 | 2): HalfScore {
  const halfAt = halfSize(rounds);
  const slice = rounds.filter((r) =>
    half === 1 ? r.round <= halfAt : r.round > halfAt,
  );
  return {
    t: slice.filter((r) => r.winner === "T").length,
    ct: slice.filter((r) => r.winner === "CT").length,
  };
}

export interface WinStreak {
  side: Side;
  length: number;
  from: number;
  to: number;
}

/** 最长连胜（按开局阵营 winner 字段统计） */
export function longestStreak(rounds: RoundSummary[]): WinStreak {
  let best: WinStreak = { side: "T", length: 0, from: 1, to: 1 };
  let cur: WinStreak | null = null;
  for (const r of rounds) {
    if (cur && cur.side === r.winner) {
      cur.length++;
      cur.to = r.round;
    } else {
      cur = { side: r.winner, length: 1, from: r.round, to: r.round };
    }
    if (cur.length > best.length) best = { ...cur };
  }
  return best;
}

/** 逐回合净胜分（开局 T 方视角累计领先），含 R0 起点 */
export function momentumSeries(rounds: RoundSummary[]) {
  let lead = 0;
  const pts = [{ round: 0, lead: 0, scoreT: 0, scoreCT: 0, keyReason: "" }];
  for (const r of rounds) {
    lead += r.winner === "T" ? 1 : -1;
    pts.push({
      round: r.round,
      lead,
      scoreT: r.scoreT,
      scoreCT: r.scoreCT,
      keyReason: r.keyReason ?? "",
    });
  }
  return pts;
}

export interface Highlight {
  icon: "crosshair" | "zap" | "shield";
  title: string;
  sub: string;
}

/** 从数据推导三条本场亮点 */
export function deriveHighlights(data: AnalysisResult): Highlight[] {
  const out: Highlight[] = [];

  // 1. 单回合最多击杀
  let bestRound: RoundSummary | null = null;
  let bestActor = "";
  let bestKills = 0;
  for (const r of data.rounds) {
    const count = new Map<string, number>();
    for (const e of r.events) {
      if (e.type === "kill" && e.actor) {
        count.set(e.actor, (count.get(e.actor) ?? 0) + 1);
      }
    }
    for (const [name, k] of count) {
      if (k > bestKills) {
        bestKills = k;
        bestActor = name;
        bestRound = r;
      }
    }
  }
  if (bestRound && bestKills >= 3) {
    out.push({
      icon: "crosshair",
      title: `${bestActor} 单回合 ${bestKills} 杀`,
      sub: `Round ${bestRound.round} · ${
        bestRound.isKeyRound ? bestRound.keyReason ?? "关键回合" : "全场最佳回合"
      }`,
    });
  }

  // 2. ECO / 强起翻盘（装备价值差最大的一场翻盘）
  let upset: RoundSummary | null = null;
  let upsetDiff = 0;
  for (const r of data.rounds) {
    const winnerVal = r.winner === "T" ? r.equipValueT : r.equipValueCT;
    const loserVal = r.winner === "T" ? r.equipValueCT : r.equipValueT;
    const diff = loserVal - winnerVal;
    if (diff > upsetDiff && diff > 3000) {
      upset = r;
      upsetDiff = diff;
    }
  }
  if (upset) {
    const team = upset.winner === "T" ? data.match.teamTName : data.match.teamCTName;
    out.push({
      icon: "zap",
      title: `${team} 经济劣势翻盘`,
      sub: `Round ${upset.round} · 装备差 -$${upsetDiff.toLocaleString()} 取胜`,
    });
  }

  // 3. 残局之王
  const clutchKing = [...data.players].sort(
    (a, b) => b.clutchWins - a.clutchWins || b.clutchAttempts - a.clutchAttempts,
  )[0];
  if (clutchKing && clutchKing.clutchWins > 0) {
    const rate = clutchKing.clutchAttempts
      ? Math.round((clutchKing.clutchWins / clutchKing.clutchAttempts) * 100)
      : 0;
    out.push({
      icon: "shield",
      title: `${clutchKing.name} ${clutchKing.clutchWins} 次残局获胜`,
      sub: `${clutchKing.clutchAttempts} 次 1vX 尝试 · 转化率 ${rate}%`,
    });
  }

  return out.slice(0, 3);
}

/** 队伍聚合指标（按开局阵营分组） */
export interface TeamAgg {
  kills: number;
  avgAdr: number;
  avgKast: number;
  firstKills: number;
  flashAssists: number;
}

export function teamAgg(players: PlayerStat[], side: Side): TeamAgg {
  const team = players.filter((p) => p.startSide === side);
  const n = Math.max(1, team.length);
  return {
    kills: team.reduce((s, p) => s + p.kills, 0),
    avgAdr: team.reduce((s, p) => s + p.adr, 0) / n,
    avgKast: team.reduce((s, p) => s + p.kast, 0) / n,
    firstKills: team.reduce((s, p) => s + p.firstKills, 0),
    flashAssists: team.reduce((s, p) => s + p.flashAssists, 0),
  };
}
