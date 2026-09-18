// RETAKE 内置示例对局（设计约定的兜底数据）：
// Mirage 13:9，NOVA（T 开局）vs AETHER（CT 开局），MR12，24 回合。
// 主角玩家（"你"）= s1mple丶Fan（NOVA）。
// 由确定性 PRNG 生成，保证每次渲染数据一致。
import type {
  AnalysisResult,
  CoachAdvice,
  HeatPoint,
  PlayerStat,
  RoundEvent,
  RoundSummary,
  Side,
  UtilityStats,
} from "@contracts/analysis";

// mulberry32 确定性伪随机
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEAM_NOVA = ["s1mple丶Fan", "NovaRain", "k1to", "MIR", "z4kr"];
const TEAM_AETHER = ["w0nder", "blameF", "stavn", "huNter", "nexa"];
const RIFLES = ["ak47", "m4a1", "m4a4", "awp", "galilar", "famas"];
const PISTOLS = ["usp_silencer", "glock", "p250", "deagle"];
const UTIL_WEAPONS = ["hegrenade", "molotov", "inferno"];

// 回合胜者序列（按开局阵营 T=NOVA 计分）：上半场 6:6，下半场 7:3 → 13:9
const WINNERS: Side[] = [
  "T", "T", "T", "CT", "CT", "T", "CT", "T", "T", "CT", "CT", "CT",
  "T", "CT", "CT", "T", "T", "CT", "T", "CT", "T", "T", "CT", "T",
];
const REASONS: RoundSummary["winReason"][] = [
  "elimination", "bomb_exploded", "elimination", "elimination", "bomb_defused",
  "bomb_exploded", "elimination", "elimination", "bomb_exploded", "elimination",
  "bomb_defused", "elimination", "elimination", "elimination", "bomb_exploded",
  "bomb_defused", "elimination", "elimination", "bomb_exploded", "elimination",
  "elimination", "bomb_exploded", "elimination", "elimination",
];

export function buildMockMatch(): AnalysisResult {
  const rand = rng(20260824);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  // ---- 逐回合事件与比分 ----
  const rounds: RoundSummary[] = [];
  const killCount = new Map<string, number>();
  const deathCount = new Map<string, number>();
  const killsPerRound = new Map<string, number[]>();
  [...TEAM_NOVA, ...TEAM_AETHER].forEach((p) => killsPerRound.set(p, []));

  // 简单经济模拟
  let moneyT = 4000;
  let moneyCT = 4000;
  let lossT = 0;
  let lossCT = 0;

  let scoreT = 0;
  let scoreCT = 0;

  for (let r = 1; r <= 24; r++) {
    const winner = WINNERS[r - 1];
    const reason = REASONS[r - 1];
    const isPistol = r === 1 || r === 13;

    // 经济：买类型与装备价值
    let buyT: RoundSummary["buyTypeT"];
    let buyCT: RoundSummary["buyTypeCT"];
    if (isPistol) {
      buyT = buyCT = "full_eco";
      moneyT = moneyCT = 4000;
      lossT = lossCT = 0;
    } else {
      const decide = (money: number): RoundSummary["buyTypeT"] => {
        if (money > 20000) return "full_buy";
        if (money > 14500) return rand() > 0.4 ? "force" : "full_eco";
        if (money > 8000) return rand() > 0.5 ? "semi" : "full_eco";
        return "full_eco";
      };
      buyT = decide(moneyT);
      buyCT = decide(moneyCT);
    }
    const spend = (buy: string) =>
      buy === "full_buy"
        ? 21000 + rand() * 6000
        : buy === "force"
          ? 15000 + rand() * 4000
          : buy === "semi"
            ? 8000 + rand() * 4000
            : 800 + rand() * 2500;
    const equipValueT = Math.round(isPistol ? 2200 + rand() * 1500 : spend(buyT));
    const equipValueCT = Math.round(isPistol ? 2200 + rand() * 1500 : spend(buyCT));

    // 赛后就绪的经济流转
    const winBonus = reason === "elimination" ? 3250 * 5 : 3500 * 5;
    const lossBonus = (loss: number) => (1400 + Math.min(loss, 4) * 500) * 5;
    if (winner === "T") {
      moneyT = winBonus + 9000 + rand() * 4000;
      moneyCT = lossBonus(lossCT);
      lossT = 0;
      lossCT++;
    } else {
      moneyCT = winBonus + 9000 + rand() * 4000;
      moneyT = lossBonus(lossT);
      lossCT = 0;
      lossT++;
    }

    // 事件流：安包/拆包 + 击杀
    const events: RoundEvent[] = [];
    const tSide = [...TEAM_NOVA];
    const ctSide = [...TEAM_AETHER];
    const alive = new Set([...tSide, ...ctSide]);
    const dur = 45 + rand() * 75;
    const plantAt = reason === "bomb_exploded" || reason === "bomb_defused"
      ? 25 + rand() * 40
      : rand() > 0.6
        ? 30 + rand() * 50
        : null;

    const winTeam = winner === "T" ? tSide : ctSide;
    const loseTeam = winner === "T" ? ctSide : tSide;
    const nKills = isPistol ? 5 : 5 + Math.floor(rand() * 3);
    for (let i = 0; i < nKills; i++) {
      const killerPool = i < nKills - 1 && rand() > 0.75 ? loseTeam : winTeam;
      const aliveKillers = killerPool.filter((p) => alive.has(p));
      const aliveVictims = (killerPool === winTeam ? loseTeam : winTeam).filter(
        (p) => alive.has(p),
      );
      if (!aliveKillers.length || !aliveVictims.length) break;
      const killer = pick(aliveKillers);
      const victim = pick(aliveVictims);
      alive.delete(victim);
      const t = Math.min(dur - 2, 8 + rand() * (dur - 10));
      const weapon = isPistol ? pick(PISTOLS) : rand() > 0.08 ? pick(RIFLES) : pick(UTIL_WEAPONS);
      events.push({
        t: Math.round(t * 10) / 10,
        type: "kill",
        actor: killer,
        victim,
        weapon,
        headshot: rand() > 0.55,
        side: tSide.includes(killer) ? "T" : "CT",
      });
      killCount.set(killer, (killCount.get(killer) ?? 0) + 1);
      deathCount.set(victim, (deathCount.get(victim) ?? 0) + 1);
    }
    if (plantAt !== null) {
      events.push({
        t: Math.round(Math.min(plantAt, dur - 5) * 10) / 10,
        type: "plant",
        actor: pick(tSide.filter((p) => alive.has(p)) ?? tSide),
      });
      if (reason === "bomb_exploded")
        events.push({ t: Math.round((Math.min(plantAt, dur - 5) + 40) * 10) / 10, type: "explode" });
      if (reason === "bomb_defused")
        events.push({
          t: Math.round((dur - 4) * 10) / 10,
          type: "defuse",
          actor: pick(ctSide),
        });
    }
    events.sort((a, b) => a.t - b.t);

    // killsPerRound 记录
    [...TEAM_NOVA, ...TEAM_AETHER].forEach((p) => {
      const c = events.filter((e) => e.type === "kill" && e.actor === p).length;
      killsPerRound.get(p)!.push(c);
    });

    if (winner === "T") scoreT++;
    else scoreCT++;

    const isKey =
      isPistol || scoreT === 12 || scoreCT === 12 ||
      ((buyT === "full_eco" || buyT === "semi") && winner === "T" && buyCT === "full_buy") ||
      ((buyCT === "full_eco" || buyCT === "semi") && winner === "CT" && buyT === "full_buy");

    rounds.push({
      round: r,
      winner,
      winReason: reason,
      scoreT,
      scoreCT,
      durationSec: Math.round(dur),
      mvpName: events.find((e) => e.type === "kill")?.actor,
      equipValueT,
      equipValueCT,
      buyTypeT: buyT,
      buyTypeCT: buyCT,
      events,
      isKeyRound: isKey,
      keyReason: isPistol
        ? "手枪局"
        : scoreT === 12 || scoreCT === 12
          ? "赛点局"
          : isKey
            ? "eco 翻盘"
            : undefined,
    });
  }

  // ---- 选手数据（击杀/死亡由事件流推导，其余指标按人设手工标定） ----
  type Persona = {
    adr: number; kast: number; hs: number; fk: number; fd: number;
    clutchA: number; clutchW: number; mvps: number; score: number;
    flashA: number; flashed: number; utilDmg: number; rating: number;
    awpRate?: number;
  };
  const personas: Record<string, Persona> = {
    "s1mple丶Fan": { adr: 82.4, kast: 67.7, hs: 36.2, fk: 5, fd: 7, clutchA: 6, clutchW: 2, mvps: 4, score: 58, flashA: 1, flashed: 9, utilDmg: 132, rating: 1.08 },
    NovaRain: { adr: 78.9, kast: 74.2, hs: 48.5, fk: 4, fd: 3, clutchA: 4, clutchW: 2, mvps: 5, score: 61, flashA: 3, flashed: 14, utilDmg: 188, rating: 1.16 },
    k1to: { adr: 71.2, kast: 70.8, hs: 44.1, fk: 3, fd: 4, clutchA: 3, clutchW: 1, mvps: 3, score: 49, flashA: 5, flashed: 21, utilDmg: 205, rating: 1.04 },
    MIR: { adr: 66.8, kast: 72.5, hs: 41.7, fk: 2, fd: 5, clutchA: 2, clutchW: 1, mvps: 2, score: 44, flashA: 4, flashed: 18, utilDmg: 176, rating: 0.98 },
    z4kr: { adr: 59.3, kast: 65.4, hs: 39.4, fk: 2, fd: 6, clutchA: 2, clutchW: 0, mvps: 1, score: 37, flashA: 2, flashed: 8, utilDmg: 98, rating: 0.87 },
    w0nder: { adr: 88.1, kast: 76.9, hs: 52.3, fk: 6, fd: 3, clutchA: 5, clutchW: 3, mvps: 6, score: 66, flashA: 2, flashed: 11, utilDmg: 154, rating: 1.28, awpRate: 0.4 },
    blameF: { adr: 76.5, kast: 73.1, hs: 46.8, fk: 3, fd: 4, clutchA: 4, clutchW: 2, mvps: 4, score: 55, flashA: 3, flashed: 13, utilDmg: 167, rating: 1.11 },
    stavn: { adr: 69.7, kast: 68.3, hs: 43.2, fk: 3, fd: 5, clutchA: 3, clutchW: 1, mvps: 2, score: 46, flashA: 4, flashed: 16, utilDmg: 193, rating: 0.99 },
    huNter: { adr: 63.4, kast: 66.7, hs: 40.5, fk: 2, fd: 5, clutchA: 2, clutchW: 0, mvps: 2, score: 41, flashA: 5, flashed: 19, utilDmg: 181, rating: 0.92 },
    nexa: { adr: 55.8, kast: 62.5, hs: 37.9, fk: 1, fd: 6, clutchA: 1, clutchW: 0, mvps: 1, score: 33, flashA: 3, flashed: 10, utilDmg: 122, rating: 0.81 },
  };

  const players: PlayerStat[] = [...TEAM_NOVA, ...TEAM_AETHER].map((name) => {
    const persona = personas[name];
    const isNova = TEAM_NOVA.includes(name);
    const kills = killCount.get(name) ?? 0;
    const deaths = deathCount.get(name) ?? 0;
    const kpr = killsPerRound.get(name)!;
    const weaponKills: Record<string, number> = {};
    // 按人设分配武器击杀分布
    let remain = kills;
    const pool = isNova ? ["ak47", "awp", "glock", "galilar", "deagle"] : ["m4a1", "m4a4", "awp", "usp_silencer", "famas"];
    for (const w of pool) {
      if (remain <= 0) break;
      const share =
        w === "awp"
          ? Math.round(kills * (persona.awpRate ?? (name === "s1mple丶Fan" ? 0.25 : 0.1)))
          : Math.round(remain * (0.45 + rand() * 0.3));
      const n = Math.min(remain, Math.max(0, share));
      if (n > 0) weaponKills[w] = n;
      remain -= n;
    }
    if (remain > 0) weaponKills[pool[0]] = (weaponKills[pool[0]] ?? 0) + remain;

    return {
      steamid: `7656119${String(8000000000 + Math.floor(rand() * 99999999))}`,
      name,
      teamName: isNova ? "NOVA" : "AETHER",
      startSide: isNova ? "T" : "CT",
      kills,
      deaths,
      assists: Math.round(kills * (0.3 + rand() * 0.25)),
      kd: deaths ? Math.round((kills / deaths) * 100) / 100 : kills,
      adr: persona.adr,
      kast: persona.kast,
      hsPercent: persona.hs,
      firstKills: persona.fk,
      firstDeaths: persona.fd,
      openingDuelWinRate:
        persona.fk + persona.fd
          ? Math.round((persona.fk / (persona.fk + persona.fd)) * 1000) / 10
          : 0,
      tradeKills: Math.max(1, Math.round(persona.fk * 0.8)),
      tradedDeaths: Math.max(1, Math.round(persona.fd * 0.7)),
      postPlantRounds: persona.clutchA + 2,
      postPlantSurvivalRounds: persona.clutchA,
      clutchAttempts: persona.clutchA,
      clutchWins: persona.clutchW,
      multiKillRounds: kpr.filter((c) => c >= 2).length,
      mvps: persona.mvps,
      score: persona.score,
      rating: persona.rating,
      flashAssists: persona.flashA,
      enemiesFlashed: persona.flashed,
      utilityDamage: persona.utilDmg,
      weaponKills,
      killsPerRound: kpr,
    };
  });

  // ---- 热力图点（围绕 Mirage 热点聚类：A 点 / B 点 / 中路 / A1 / B2） ----
  const clusters = [
    { x: 0.24, y: 0.22, w: 0.28 }, // A 包点
    { x: 0.78, y: 0.26, w: 0.24 }, // B 包点
    { x: 0.5, y: 0.52, w: 0.22 }, // 中路
    { x: 0.3, y: 0.45, w: 0.14 }, // A1/A2 楼
    { x: 0.72, y: 0.5, w: 0.12 }, // B 小
  ];
  const heat: HeatPoint[] = [];
  const allPlayers = [...TEAM_NOVA, ...TEAM_AETHER];
  for (let i = 0; i < 220; i++) {
    const c = pick(clusters);
    const spread = 0.05 + rand() * 0.04;
    const x = Math.min(0.97, Math.max(0.03, c.x + (rand() - 0.5) * 2 * spread * (1 / c.w) * 0.1));
    const y = Math.min(0.97, Math.max(0.03, c.y + (rand() - 0.5) * 2 * spread * (1 / c.w) * 0.1));
    const kind: HeatPoint["kind"] =
      i < 130 ? "death" : i < 195 ? "kill" : i < 210 ? "firstkill" : "utility";
    const player = pick(allPlayers);
    heat.push({
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      kind,
      side: TEAM_NOVA.includes(player) ? "T" : "CT",
      player,
      round: 1 + Math.floor(rand() * 24),
    });
  }

  // ---- 道具统计 ----
  const utilNades: Record<string, [number, number, number, number]> = {
    "s1mple丶Fan": [6, 3, 2, 2],
    NovaRain: [8, 5, 3, 3],
    k1to: [11, 6, 4, 4],
    MIR: [9, 7, 4, 3],
    z4kr: [5, 4, 2, 2],
    w0nder: [4, 3, 2, 3],
    blameF: [7, 6, 3, 3],
    stavn: [10, 7, 4, 4],
    huNter: [12, 8, 5, 3],
    nexa: [8, 6, 3, 2],
  };
  const utility: UtilityStats[] = allPlayers.map((name) => {
    const [fl, sm, mo, he] = utilNades[name];
    const p = players.find((pl) => pl.name === name)!;
    return {
      player: name,
      flashes: fl,
      smokes: sm,
      molotovs: mo,
      hes: he,
      flashAssists: p.flashAssists,
      enemiesFlashed: p.enemiesFlashed,
      avgBlindDuration: Math.round((1.2 + rand() * 1.6) * 100) / 100,
      utilityDamage: p.utilityDamage,
    };
  });

  // ---- 教练建议（围绕主角 s1mple丶Fan 的真实痛点 + 团队经济） ----
  const coach: CoachAdvice[] = [
    {
      id: "adv-1",
      player: "s1mple丶Fan",
      category: "positioning",
      priority: 1,
      title: "首杀对枪胜率过低，开局激进在被持续惩罚",
      description:
        "你参与了 12 次开局首杀对枪，仅赢下 41.7%。输掉首杀意味着全队 4v5 开局。建议：① 开局前 20 秒避免无闪光掩护的干拉；② 选择 off-angle（非常规位）代替常规对枪位；③ 状态不好时主动让出第一交火权，改打信息位。",
      evidence: [
        { label: "首杀对枪", value: "5胜 / 7负", ref: "胜率 41.7%" },
        { label: "平均对枪胜率参考", value: "≥ 50%" },
      ],
      relatedRounds: [3, 7, 10, 15, 20],
    },
    {
      id: "adv-2",
      player: "s1mple丶Fan",
      category: "aim",
      priority: 1,
      title: "爆头率 36.2%，低于同水平玩家基准线 45%",
      description:
        "你的击杀中仅 36.2% 为爆头，而高分段步枪手基准约 45-50%。核心问题通常是准星预瞄高度：移动时准星看地/看胸，遇到人再抬枪。建议：① 死斗模式刻意只瞄头线，每天 15 分钟；② 过点时准星始终贴在敌人可能出现的头线高度；③ 中距离把扫射改为 2-3 发点射。",
      evidence: [
        { label: "HS%", value: "36.2%", ref: "基准 45%" },
        { label: "总击杀", value: String(killCount.get("s1mple丶Fan") ?? 0) },
      ],
      relatedRounds: [],
    },
    {
      id: "adv-3",
      category: "economy",
      priority: 2,
      title: "两次强起落败直接导致经济连环崩盘",
      description:
        "第 10、21 回合，队伍在经济不足时选择强起（force-buy），落败后下一回合被迫纯 ECO，相当于连续送出两分。强起只应出现在：连败奖励刚重置需要止损、或赛点背水一战。其余局面建议纯 ECO 攒连败奖励，下回合全枪全弹打长枪局。",
      evidence: [
        { label: "问题回合", value: "R10, R21" },
        { label: "连带损失", value: "≈ 4 个回合" },
      ],
      relatedRounds: [10, 11, 21, 22],
    },
    {
      id: "adv-4",
      player: "s1mple丶Fan",
      category: "teamwork",
      priority: 2,
      title: "闪光弹利用率低：6 颗闪光仅 1 次助攻",
      description:
        "你的闪光助攻率（16.7%）明显低于队友 k1to（45%）。闪光的价值在于服务队友进点而非自用。建议：① 进点前与队友约定「闪光信号」；② 学习包点常规爆点闪（A 点高闪、B 小过点闪）；③ 减少单人干拉时的自丢自 peek。",
      evidence: [
        { label: "闪光助攻", value: "1 次", ref: "6 颗闪光" },
        { label: "闪白敌人", value: "9 次" },
      ],
      relatedRounds: [8, 16, 19],
    },
    {
      id: "adv-5",
      player: "s1mple丶Fan",
      category: "positioning",
      priority: 2,
      title: "回合前 30 秒死亡率偏高（50%）",
      description:
        "你的死亡有一半发生在回合开局阶段。过早减员让队伍战术无法展开。建议：T 方开局先卡默认位拿信息，等道具就位再接触；避免每回合重复同一前压路线——对手从第 7 回合起明显针对了你的走位。",
      evidence: [{ label: "早死回合", value: "R3, R7, R10, R15, R18, R20" }],
      relatedRounds: [3, 7, 10, 15, 18, 20],
    },
    {
      id: "adv-6",
      player: "s1mple丶Fan",
      category: "aim",
      priority: 3,
      title: "残局 2/6，拆分 1v1 能力有提升空间",
      description:
        "6 次残局仅转化 2 次。残局核心是拆分：利用掩体把 1v2 拆成两个 1v1、用假下包逼对手露头、静步换位制造信息差。建议回看第 14、18 回合的站位选择。",
      evidence: [{ label: "残局胜率", value: "2 / 6", ref: "33%" }],
      relatedRounds: [14, 18],
    },
    {
      id: "adv-7",
      category: "teamwork",
      priority: 3,
      title: "下半场 CT 方中路控制偏弱",
      description:
        "换边后中路首杀热点 60% 由 AETHER 控制。建议：中路双人前顶与狙击枪支架二选一，避免单人无道具干拉中路；B 小与拱门形成交叉火力。",
      evidence: [{ label: "中路首杀控制", value: "40%", ref: "下半场" }],
      relatedRounds: [14, 15, 18, 20, 23],
    },
  ];

  const economy = rounds.map((r) => ({
    round: r.round,
    valueT: r.equipValueT,
    valueCT: r.equipValueCT,
  }));

  return {
    match: {
      id: "demo",
      mapName: "de_mirage",
      displayMap: "Mirage",
      teamTName: "NOVA",
      teamCTName: "AETHER",
      scoreT: 13,
      scoreCT: 9,
      roundsTotal: 24,
      durationSec: 2436,
      playedAt: "2026-08-22T14:30:00.000Z",
      source: "demo",
      fileName: "match-mirage-20260822.dem",
    },
    players,
    rounds,
    heat,
    utility,
    coach,
    economy,
    evidence: [],
  };
}

/** 全局单例，保证跨页面数据一致 */
export const MOCK_MATCH: AnalysisResult = buildMockMatch();
