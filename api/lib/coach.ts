// 教练建议规则引擎：基于统计数据 + 坏习惯证据生成个性化建议。
// 设计原则：
// 1. 先定"本场角色"（主狙/突破/辅助/补枪位/残局手），同一问题按角色给不同角度
// 2. 证据驱动优先：用真实回合事件生成建议并绑定 relatedRounds
// 3. 相对弱点：每人六维雷达最弱项（队内对比），不同人弱项天然不同
// 4. 有正有负：每人至少一条"优势保持/深化"建议
import type {
  CoachAdvice,
  EvidenceItem,
  HeatPoint,
  PlayerStat,
  RoundSummary,
  UtilityStats,
} from "../../contracts/analysis";

interface CoachInput {
  players: PlayerStat[];
  rounds: RoundSummary[];
  utility: UtilityStats[];
  heat: HeatPoint[];
  economy: { round: number; valueT: number; valueCT: number }[];
  evidence: EvidenceItem[];
}

let seq = 0;
function advice(a: Omit<CoachAdvice, "id">): CoachAdvice {
  return { id: `adv-${++seq}`, ...a };
}

type Role = "awp" | "entry" | "support" | "trader" | "clutcher" | "rifler";

const ROLE_LABEL: Record<Role, string> = {
  awp: "主狙",
  entry: "突破手",
  support: "道具辅助",
  trader: "补枪位",
  clutcher: "残局手",
  rifler: "步枪手",
};

/** 本场角色：由队内相对数据推导，不看名字 */
function roleOf(p: PlayerStat, players: PlayerStat[]): Role {
  const team = players.filter((x) => x.teamName === p.teamName);
  const pool = team.length ? team : players;
  const awpKills = p.weaponKills["awp"] ?? 0;
  if (p.kills > 0 && awpKills / p.kills >= 0.3) return "awp";
  const maxFk = Math.max(...pool.map((x) => x.firstKills), 0);
  if (p.firstKills >= maxFk && p.firstKills >= 3) return "entry";
  const maxFlash = Math.max(...pool.map((x) => x.flashAssists), 0);
  if (p.flashAssists >= maxFlash && p.flashAssists >= 3) return "support";
  const maxTrade = Math.max(...pool.map((x) => x.tradeKills), 0);
  if (p.tradeKills >= maxTrade && p.tradeKills >= 4) return "trader";
  const maxClutch = Math.max(...pool.map((x) => x.clutchAttempts), 0);
  if (p.clutchAttempts >= maxClutch && p.clutchAttempts >= 3) return "clutcher";
  return "rifler";
}

/** 六维雷达（与前端 radarScores 同款公式，0-100） */
function radar(p: PlayerStat) {
  const clamp100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return {
    aim: clamp100((p.adr / 110) * 60 + p.hsPercent * 0.4),
    aware: clamp100(p.kast),
    entry: clamp100(p.openingDuelWinRate),
    clutch:
      p.clutchAttempts > 0
        ? clamp100((p.clutchWins / p.clutchAttempts) * 100)
        : 0,
    util: clamp100(p.flashAssists * 10 + p.enemiesFlashed * 2 + p.utilityDamage / 8),
    econ: clamp100(45 + (p.kd - 1) * 35 + p.mvps * 4),
  };
}

const RADAR_DIMS: { key: keyof ReturnType<typeof radar>; label: string }[] = [
  { key: "aim", label: "枪法" },
  { key: "aware", label: "意识/存活" },
  { key: "entry", label: "首杀对枪" },
  { key: "clutch", label: "残局" },
  { key: "util", label: "道具" },
  { key: "econ", label: "经济/关键发挥" },
];

/** 按角色定制同一弱点的表述角度 */
function weaknessAdvice(
  p: PlayerStat,
  role: Role,
  dim: string,
  score: number,
  teamAvg: number,
): Omit<CoachAdvice, "id"> | null {
  const below = score < teamAvg - 8;
  const base = {
    player: p.name,
    evidence: [
      { label: "六维值", value: String(score), ref: `队内均值 ${teamAvg}` },
    ],
    relatedRounds: [] as number[],
  };
  switch (dim) {
    case "aim":
      if (!below) return null;
      return {
        ...base,
        category: "aim",
        priority: score < 40 ? 1 : 2,
        title:
          role === "awp"
            ? "狙击命中率波动大，架点选择偏冒险"
            : "伤害效率偏低，交火质量需要打磨",
        description:
          role === "awp"
            ? `你的六维"枪法"仅 ${score}（队内均值 ${teamAvg}）。作为主狙，ADR ${p.adr} 说明太多架枪没有转化为命中——优先选择有退路的非预瞄位，被闪或空枪后立即换位，不要原地二次架同一缝。`
            : `你的六维"枪法"仅 ${score}（队内均值 ${teamAvg}）。ADR ${p.adr}、爆头率 ${p.hsPercent}% 都低于应有水平。${role === "entry" ? "作为突破手，首接触前的预瞄点决定生死——" : ""}建议：准星全程保持头线、中距离改点射，死斗模式刻意只打头 15 分钟热身。`,
      };
    case "aware":
      if (p.kast >= 65) return null;
      return {
        ...base,
        category: "positioning",
        priority: p.kast < 55 ? 1 : 2,
        title: "回合存在感不足，大量回合零影响",
        description: `KAST ${p.kast}% 意味着约 ${Math.round(100 - p.kast)}% 的回合你既没造成杀伤也没存活。${role === "entry" ? "突破手的高风险不等于送首死——无闪光掩护的干拉要减半；" : role === "awp" ? "狙击手的存活就是信息，不要为了一个人头放弃后点；" : ""}把「活到 30 秒后」当成本场唯一目标，你会自然等到更多可乘之机。`,
      };
    case "entry":
      if (p.firstKills + p.firstDeaths < 3) {
        return {
          ...base,
          category: "positioning",
          priority: 3,
          title: "首杀参与度过低，节奏偏被动",
          description: `你全场仅 ${p.firstKills + p.firstDeaths} 次首杀接触。你的伤害能力（ADR ${p.adr}）说明对枪不虚，缺的是开局攻击性：默认控图阶段尝试 1-2 次有道具掩护的前压，拿到首杀就转点提速，拿不到也有信息价值。`,
        };
      }
      if (p.openingDuelWinRate >= 45) return null;
      return {
        ...base,
        category: "positioning",
        priority: p.openingDuelWinRate < 30 ? 1 : 2,
        title: "首杀对枪在被惩罚，胜率需要止损",
        description: `首杀对枪 ${p.openingDuelWinRate.toFixed(0)}% 胜率（${p.firstKills} 胜 ${p.firstDeaths} 负）。输掉首杀=全队 4v5。${role === "entry" ? "作为第一枪位，改打「等闪位」而非「干拉位」：让辅助先出闪你再进，胜率会立刻不同。" : "开局前 20 秒减少主动接触，改用非常规角度（off-angle）打先手。"}`,
      };
    case "clutch":
      if (p.clutchAttempts < 2 || p.clutchWins / p.clutchAttempts >= 0.5)
        return null;
      return {
        ...base,
        category: "aim",
        priority: 3,
        title: "残局拆分需要更耐心",
        description: `${p.clutchAttempts} 次残局只赢下 ${p.clutchWins} 次。残局不是拼枪，是计时和拆分：先用脚步声/假下包逼对手摊牌，把 1v2 拆成两个 1v1；时间站在守包方一边时，静步换位比直架更有效。`,
      };
    case "util":
      if (p.flashAssists * 10 + p.enemiesFlashed * 2 + p.utilityDamage / 8 >= 40)
        return null;
      return {
        ...base,
        category: "utility",
        priority: role === "support" ? 1 : 3,
        title:
          role === "support"
            ? "道具辅助的核心指标全面落后"
            : "道具参与度低，进攻缺少第三维",
        description: `闪光助攻 ${p.flashAssists}、闪白敌人 ${p.enemiesFlashed}、道具伤害 ${p.utilityDamage}。${role === "support" ? "你是队里道具责任最重的人——每套进攻至少保证一颗进点闪+一颗反清闪，和突破手约定「闪爆即出」的口令。" : "长枪局至少带一颗烟一颗闪：烟封关键过点、闪在队友进点瞬间爆，比多买一个投掷物更有性价比。"}`,
      };
    case "econ":
      if (score >= 55) return null;
      return {
        ...base,
        category: "economy",
        priority: 3,
        title: "关键回合影响力可以更高",
        description: `KD ${p.kd.toFixed(2)}、MVP ${p.mvps} 次，说明你在胶着回合的终结能力有提升空间。尝试在本方强起局更保守（保住枪械价值），在长枪局更主动（你的数据支撑得起侵略性）——把状态留给能赢的回合。`,
      };
    default:
      return null;
  }
}

/**
 * 优势保持建议：每人一条。
 * killsAttributed=false（击杀归属缺失的老 demo）时改用记分板硬数据
 * （ADR/道具伤害/爆头击杀/评分）做队内对比，保证仍能差异化。
 */
function strengthAdvice(
  p: PlayerStat,
  role: Role,
  players: PlayerStat[],
  killsAttributed: boolean,
): Omit<CoachAdvice, "id"> | null {
  if (!killsAttributed) {
    const team = players.filter((x) => x.teamName === p.teamName);
    const pool = team.length ? team : players;
    const bestOf = (fn: (x: PlayerStat) => number, min: number) => {
      const top = pool.reduce((a, b) => (fn(b) > fn(a) ? b : a));
      return top === p && fn(p) >= min ? top : undefined;
    };
    const hard: (Omit<CoachAdvice, "id"> | undefined)[] = [
      bestOf((x) => x.adr, 1)
        ? {
            player: p.name,
            category: "aim",
            priority: 3,
            title: `ADR ${p.adr} 队内第一，输出效率是本场标杆`,
            description: `在击杀数据缺失的情况下，ADR 是最可靠的强度信号。你的场均伤害全队最高，说明交火选择与命中率都在线——队友可以多围绕你的枪位设计进攻。`,
            evidence: [{ label: "ADR", value: String(p.adr), ref: "队内第一" }],
            relatedRounds: [],
          }
        : undefined,
      bestOf((x) => x.utilityDamage, 50)
        ? {
            player: p.name,
            category: "utility",
            priority: 3,
            title: `道具伤害 ${p.utilityDamage} 队内最高，道具timing在线`,
            description: `燃烧弹与手雷的转化是本场亮点。继续保持「道具先于交火」的习惯，并把爆点位置同步给队友形成联动。`,
            evidence: [{ label: "道具伤害", value: String(p.utilityDamage), ref: "队内最高" }],
            relatedRounds: [],
          }
        : undefined,
      bestOf((x) => x.score, 1)
        ? {
            player: p.name,
            category: "aim",
            priority: 3,
            title: `综合评分 ${p.score} 队内第一，关键发挥稳定`,
            description: `官方记分板评分反映的是杀伤+目标综合贡献。你排在队内第一，说明在数据受限的场次里你仍是队伍的基本盘。`,
            evidence: [{ label: "评分", value: String(p.score), ref: "队内第一" }],
            relatedRounds: [],
          }
        : undefined,
    ];
    return hard.find(Boolean) ?? null;
  }
  const r = radar(p);
  const dims = [...RADAR_DIMS].sort(
    (a, b) => (r[b.key] as number) - (r[a.key] as number),
  );
  const best = dims[0];
  const base = {
    player: p.name,
    priority: 3 as const,
    evidence: [
      { label: "六维值", value: String(r[best.key]), ref: `最强维度 · ${best.label}` },
    ],
    relatedRounds: [] as number[],
  };
  switch (role) {
    case "trader":
      return {
        ...base,
        category: "teamwork",
        title: "你是全队最稳的补枪位，把优势固化下来",
        description: `${p.tradeKills} 次成功补枪全队第一。继续保持「贴第一枪位 3-5 米跟进」的习惯，并把它变成队规：任何人首接触前报点，你负责 5 秒内完成清算。`,
      };
    case "awp":
      if ((p.weaponKills["awp"] ?? 0) >= 8)
        return {
          ...base,
          category: "positioning",
          title: "狙击火力是队伍支柱，保住存活就是保住体系",
          description: `AWP 击杀 ${p.weaponKills["awp"]} 占个人 ${Math.round(((p.weaponKills["awp"] ?? 0) / Math.max(p.kills, 1)) * 100)}%。建议队友围绕你的存活打默认：你架 A 则 B 区三人重防，你阵亡立即转保守。你的首死是最贵的资源。`,
        };
      return null;
    case "entry":
      return {
        ...base,
        category: "teamwork",
        title: "首杀嗅觉是稀缺资源，给队友配上护航道具",
        description: `${p.firstKills} 次首杀全队第一。下一步不是更多首杀，而是首杀后的转化：约定辅助在你进点后 2 秒内补第二颗闪，让 5v4 变成 5v3。`,
      };
    case "support":
      return {
        ...base,
        category: "teamwork",
        title: "道具联动已是队内标杆，扩展到默认控图",
        description: `${p.flashAssists} 次闪光助攻说明你的道具 timing 在线。把这些闪从「进攻爆点」延伸一半到「默认控图」——中期阶段帮边路队友反清一个点位，中期信息价值不亚于一个击杀。`,
      };
    case "clutcher":
      return {
        ...base,
        category: "positioning",
        title: "残局冷静度是队伍底牌",
        description: `${p.clutchWins}/${p.clutchAttempts} 次残局。把残局里的处理沉淀给全队：每次赢下残局后口头复盘一个关键决策（走位/假信息/计时），这比多赢一个残局更值钱。`,
      };
    default:
      if ((r[best.key] as number) >= 60)
        return {
          ...base,
          category: "aim",
          title: `${best.label}是你的基本盘，用它带动其他维度`,
          description: `${best.label}六维 ${r[best.key]} 是队内前列。以它为依托补短板：训练时先用 ${best.label} 的长板局建立手感，再针对性练最弱维度，效率比平均用力高。`,
        };
      return null;
  }
}

export function generateCoachAdvice(input: CoachInput): CoachAdvice[] {
  seq = 0;
  const { players, rounds, utility, evidence } = input;
  const out: CoachAdvice[] = [];
  if (!players.length || !rounds.length) return out;

  // 击杀归属是否可用：老版本 demo 在解析器下击杀事件无玩家名，
  // 此时跳过所有依赖击杀事件的个人建议，避免全员触发同款文案。
  const killsAttributed = players.some((p) => p.kills + p.deaths > 0);

  const nRounds = rounds.length;
  const avgAdr = players.reduce((a, p) => a + p.adr, 0) / players.length;

  // ---- 每人聚合证据（steamid → items） ----
  const evidenceByPlayer = new Map<string, EvidenceItem[]>();
  for (const e of evidence) {
    const list = evidenceByPlayer.get(e.playerId) ?? [];
    list.push(e);
    evidenceByPlayer.set(e.playerId, list);
  }

  for (const p of players) {
    const role = roleOf(p, players);
    const personal: Omit<CoachAdvice, "id">[] = [];
    const ev = evidenceByPlayer.get(p.steamid) ?? [];
    const evByIssue = new Map<string, EvidenceItem[]>();
    for (const e of ev) {
      const list = evByIssue.get(e.issue) ?? [];
      list.push(e);
      evByIssue.set(e.issue, list);
    }
    const evRounds = (issue: string) =>
      (evByIssue.get(issue) ?? []).map((e) => e.round).slice(0, 6);

    // 1) 证据驱动建议（最高优先级：真实回合 + 具体回合号）
    const firstDeaths = evByIssue.get("solo_first_death") ?? [];
    if (firstDeaths.length >= 2) {
      personal.push({
        player: p.name,
        category: "positioning",
        priority: firstDeaths.length >= 4 ? 1 : 2,
        title: `无补枪首死 ${firstDeaths.length} 次，你的开局接触在孤立进行`,
        description:
          role === "entry"
            ? `${firstDeaths.length} 个回合你作为第一枪位阵亡且无人补枪。突破手的首死可以接受，但孤立首死不行：进点前等辅助的爆点闪、或与第二枪位约定 600 单位内跟进，把「单人首死」变成「双人交换」。`
            : `${firstDeaths.length} 个回合你第一个阵亡且 5 秒内无人补枪。默认控图阶段不要独自扩大接触面：等队友道具、报清自己要抢的点位，让队友在可补枪距离内再行动。`,
        evidence: [
          { label: "首死回合", value: firstDeaths.map((e) => `R${e.round}`).join(" ") },
        ],
        relatedRounds: evRounds("solo_first_death"),
      });
    }

    const spacing = evByIssue.get("trade_spacing_review") ?? [];
    if (spacing.length >= 2) {
      personal.push({
        player: p.name,
        category: "teamwork",
        priority: 2,
        title: `死亡未被补枪 ${spacing.length} 次，跟进距离是队里短板`,
        description: `你的 ${spacing.length} 次死亡发生在队友可支援范围内却没有被补。CT 方回防/补位时与相邻队友保持一条枪线的距离；T 方进点时分工明确「谁跟谁的枪」。死亡位置信息第一时间报出，让补枪者不用猜。`,
        evidence: [
          { label: "涉及回合", value: spacing.map((e) => `R${e.round}`).join(" ") },
        ],
        relatedRounds: evRounds("trade_spacing_review"),
      });
    }

    const flashes = evByIssue.get("team_flash") ?? [];
    if (flashes.length >= 2) {
      personal.push({
        player: p.name,
        category: "utility",
        priority: 2,
        title: `闪到队友 ${flashes.length} 次，闪光落点需要约束`,
        description: `你的闪光 ${flashes.length} 次致盲队友 1.5 秒以上（回合见证据板块）。改进：背身闪先报「闪爆即出」、深点闪确认队友不会进点再丢；近距离混战优先用燃烧弹/烟雾切割而非闪光。`,
        evidence: [
          { label: "闪光事故", value: `${flashes.length} 次` },
        ],
        relatedRounds: evRounds("team_flash"),
      });
    }

    const postPlant = evByIssue.get("post_plant_overpeek") ?? [];
    if (postPlant.length >= 1) {
      personal.push({
        player: p.name,
        category: "positioning",
        priority: 1,
        title: `下包后站位过激，${postPlant.length} 个优势局被翻盘`,
        description: `人数领先下包后，你在 8 秒内离开可交易位置死亡，且这些回合最终都输了。下包后默认收缩：回防未到前不与对手单点纠缠，每个站位保证至少一名队友能 5 秒内补枪。`,
        evidence: [
          { label: "被翻盘回合", value: postPlant.map((e) => `R${e.round}`).join(" ") },
        ],
        relatedRounds: evRounds("post_plant_overpeek"),
      });
    }

    const repeatSpot = evByIssue.get("repeat_death_position") ?? [];
    if (repeatSpot.length >= 1) {
      personal.push({
        player: p.name,
        category: "positioning",
        priority: 3,
        title: "同一区域反复阵亡，对手已在针对你的习惯位",
        description: `你在同一位置被击杀 ${repeatSpot.length} 次（本场首次见证据页）。同一位置连续两次阵亡后，第三个回合必须换预瞄/换节奏——可以用一次假脚步反制对手的针对性预瞄。`,
        evidence: [
          { label: "重复点位", value: `${repeatSpot.length} 处` },
        ],
        relatedRounds: evRounds("repeat_death_position"),
      });
    }

    // 2) 相对弱点：六维最弱项（队内对比），按角色定制文案。
    // 击杀归属缺失时只看仍有真实数据的维度（枪法/道具），其余维度全零无区分度。
    const r = radar(p);
    const teamOf = players.filter((x) => x.teamName === p.teamName);
    const pool = teamOf.length ? teamOf : players;
    const teamAvgDim = (key: keyof typeof r) =>
      Math.round(pool.reduce((a, x) => a + (radar(x)[key] as number), 0) / pool.length);
    // 击杀归属缺失时只剩 ADR 可区分（六维其余输入全零/同值），只看枪法维
    const dimsSorted = [...RADAR_DIMS]
      .filter((d) => killsAttributed || d.key === "aim")
      .sort((a, b) => (r[a.key] as number) - (r[b.key] as number));
    for (const dim of dimsSorted.slice(0, 2)) {
      const weak = weaknessAdvice(
        p,
        role,
        dim.key,
        r[dim.key] as number,
        teamAvgDim(dim.key),
      );
      if (weak) personal.push(weak);
    }

    // 3) 优势保持（每人一条；击杀数据缺失时用记分板硬数据对比）
    const strong = strengthAdvice(p, role, players, killsAttributed);
    if (strong) personal.push(strong);

    // 4) 经典硬指标兜底：爆头率（仅队内最低且明显低于平均时触发，避免全员同款）
    const minHs = players.reduce((a, b) => (b.hsPercent < a.hsPercent ? b : a));
    const avgHs = players.reduce((a, x) => a + x.hsPercent, 0) / players.length;
    if (minHs === p && p.kills >= 8 && p.hsPercent < avgHs - 8) {
      personal.push({
        player: p.name,
        category: "aim",
        priority: 2,
        title: "队内爆头率垫底，瞄准高度需要系统性纠正",
        description: `爆头率 ${p.hsPercent}%（队内均值 ${avgHs.toFixed(1)}%）。先改预瞄高度再谈枪法：让准星习惯性停留在头线，移动中也不下垂；练枪时只用点射模式强迫自己确认爆头。`,
        evidence: [
          { label: "HS%", value: `${p.hsPercent}%`, ref: `队内均值 ${avgHs.toFixed(1)}%` },
        ],
        relatedRounds: [],
      });
    }

    // 去重后 cap 4 条，按优先级
    const seen = new Set<string>();
    const chosen = personal
      .sort((a, b) => a.priority - b.priority)
      .filter((a) => {
        if (seen.has(a.title)) return false;
        seen.add(a.title);
        return true;
      })
      .slice(0, 4);
    for (const c of chosen) out.push(advice(c));
  }

  // ---- 团队级：经济决策审计（保留） ----
  const badForceRounds: number[] = [];
  for (let i = 0; i < rounds.length - 1; i++) {
    const r = rounds[i];
    const next = rounds[i + 1];
    if (
      r.buyTypeT === "force" &&
      r.winner === "CT" &&
      next.equipValueT > 0 &&
      next.equipValueT < 6000
    )
      badForceRounds.push(r.round);
    if (
      r.buyTypeCT === "force" &&
      r.winner === "T" &&
      next.equipValueCT > 0 &&
      next.equipValueCT < 6000
    )
      badForceRounds.push(r.round);
  }
  if (badForceRounds.length >= 2) {
    out.push(
      advice({
        category: "economy",
        priority: badForceRounds.length >= 4 ? 1 : 2,
        title: "强起（force-buy）决策失误导致经济连环崩盘",
        description: `本场有 ${badForceRounds.length} 个回合在强起落败后，下一回合全队被迫纯 ECO（如第 ${badForceRounds.slice(0, 3).join("、")} 回合）。强起的正确时机：刚重置后需要连胜止损、或赛点背水一战。其他时候建议纯 ECO 攒 $1900 连败奖励，下回合全枪全弹。`,
        evidence: [
          { label: "问题回合", value: badForceRounds.join(", ") },
          { label: "次数", value: String(badForceRounds.length) },
        ],
        relatedRounds: badForceRounds.slice(0, 6),
      }),
    );
  }

  // 团队：eco 翻盘表扬
  const ecoWins = rounds.filter((r) => r.keyReason === "eco 翻盘");
  if (ecoWins.length > 0) {
    out.push(
      advice({
        category: "economy",
        priority: 3,
        title: "本场有 ECO 翻盘回合，值得复盘复制",
        description: `第 ${ecoWins.map((r) => r.round).join("、")} 回合在装备劣势下完成了翻盘。建议回看这些回合的走位与集火选择——ECO 翻盘往往来自抱团速推或偷包战术的成功执行。`,
        evidence: [{ label: "翻盘回合", value: ecoWins.map((r) => r.round).join(", ") }],
        relatedRounds: ecoWins.map((r) => r.round),
      }),
    );
  }

  // 团队：全队坏习惯证据聚合（与证据板块呼应）
  const teamFirstDeaths = evidence.filter((e) => e.issue === "solo_first_death");
  if (teamFirstDeaths.length >= 5) {
    const roundsHit = [...new Set(teamFirstDeaths.map((e) => e.round))].sort((a, b) => a - b);
    out.push(
      advice({
        category: "teamwork",
        priority: teamFirstDeaths.length >= 8 ? 1 : 2,
        title: `全队 ${teamFirstDeaths.length} 次孤立首死，默认控图缺乏联动`,
        description: `全场 ${teamFirstDeaths.length} 次首死无人补枪（涉及 ${roundsHit.length} 个回合）。这不是个人问题而是体系问题：默认阶段两人一组行动、首接触前互相确认可补枪距离，把「各自为战」改成「一人接触、全队有数」。`,
        evidence: [
          { label: "孤立首死", value: `${teamFirstDeaths.length} 次` },
          { label: "涉及回合", value: String(roundsHit.length) },
        ],
        relatedRounds: roundsHit.slice(0, 6),
      }),
    );
  }

  void nRounds;
  void avgAdr;
  void utility;
  void ROLE_LABEL;
  void killsAttributed;
  return out.sort((a, b) => a.priority - b.priority);
}
