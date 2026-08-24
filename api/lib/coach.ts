// 教练建议规则引擎：基于统计数据自动生成可执行的改进建议
import type {
  CoachAdvice,
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
}

let seq = 0;
function advice(a: Omit<CoachAdvice, "id">): CoachAdvice {
  return { id: `adv-${++seq}`, ...a };
}

export function generateCoachAdvice(input: CoachInput): CoachAdvice[] {
  seq = 0;
  const { players, rounds, utility } = input;
  const out: CoachAdvice[] = [];
  if (!players.length || !rounds.length) return out;

  const nRounds = rounds.length;
  const avgAdr = players.reduce((a, p) => a + p.adr, 0) / players.length;
  const avgHs = players.reduce((a, p) => a + p.hsPercent, 0) / players.length;
  const avgKast = players.reduce((a, p) => a + p.kast, 0) / players.length;

  for (const p of players) {
    // 早死率：前 30 秒死亡占全部死亡的比例
    const earlyDeathRounds = rounds.filter((r) =>
      r.events.some(
        (e) => e.type === "kill" && e.victim === p.name && e.t <= 30,
      ),
    );
    const earlyRate = p.deaths
      ? earlyDeathRounds.length / Math.max(p.deaths, 1)
      : 0;

    // 1) 爆头率
    if (p.kills >= 8 && p.hsPercent < avgHs - 12) {
      const sev = avgHs - p.hsPercent;
      out.push(
        advice({
          player: p.name,
          category: "aim",
          priority: sev > 20 ? 1 : 2,
          title: "爆头率显著偏低，瞄准习惯需要纠正",
          description: `你的爆头率 ${p.hsPercent}% ，低于本场平均 ${avgHs.toFixed(1)}% 。问题通常出在准星预瞄高度（头线）与扫射依赖。建议：① 死斗中刻意只打头；② 保持准星在头线高度移动而非看地；③ 中距离改用 2-3 发点射。`,
          evidence: [
            { label: "HS%", value: `${p.hsPercent}%`, ref: `平均 ${avgHs.toFixed(1)}%` },
            { label: "总击杀", value: String(p.kills) },
          ],
          relatedRounds: [],
        }),
      );
    }

    // 2) ADR 偏低
    if (p.adr < avgAdr - 15 && nRounds >= 10) {
      out.push(
        advice({
          player: p.name,
          category: "aim",
          priority: avgAdr - p.adr > 25 ? 1 : 2,
          title: "场均伤害偏低，对枪参与度或胜率不足",
          description: `你的 ADR 为 ${p.adr}，比本场平均 ${avgAdr.toFixed(1)} 低了 ${(avgAdr - p.adr).toFixed(1)}。可能是站位过于保守导致交火机会少，或对枪胜率低。建议复盘死亡回合的走位选择，避免无信息干拉；配合队友闪光再 peek。`,
          evidence: [
            { label: "ADR", value: String(p.adr), ref: `平均 ${avgAdr.toFixed(1)}` },
            { label: "K/D", value: p.kd.toFixed(2) },
          ],
          relatedRounds: [],
        }),
      );
    }

    // 3) KAST 偏低
    if (p.kast < Math.min(65, avgKast - 10) && nRounds >= 10) {
      out.push(
        advice({
          player: p.name,
          category: "positioning",
          priority: p.kast < 55 ? 1 : 2,
          title: "回合贡献度（KAST）偏低，存在大量“零影响”回合",
          description: `你的 KAST 仅 ${p.kast}%（击杀/助攻/存活/被补枪覆盖的回合占比），本场平均 ${avgKast.toFixed(1)}%。这意味着近三成回合你既没造成杀伤也没活下来。建议：减少无道具掩护的单摸，死亡后及时报点让队友补枪，优先保证存活到残局阶段。`,
          evidence: [
            { label: "KAST", value: `${p.kast}%`, ref: `平均 ${avgKast.toFixed(1)}%` },
          ],
          relatedRounds: [],
        }),
      );
    }

    // 4) 首杀对枪
    const duels = p.firstKills + p.firstDeaths;
    if (duels >= 4 && p.openingDuelWinRate < 40) {
      out.push(
        advice({
          player: p.name,
          category: "positioning",
          priority: p.openingDuelWinRate < 30 ? 1 : 2,
          title: "首杀对枪胜率过低，开局激进打法在被惩罚",
          description: `你参与了 ${duels} 次开局首杀对枪，胜率仅 ${p.openingDuelWinRate.toFixed(0)}%。输掉首杀会让全队陷入 4v5。建议：开局前 20 秒避免无闪光掩护的干拉，选择更优势的对枪角度（off-angle），或改为后点观察拿信息。`,
          evidence: [
            { label: "首杀对枪", value: `${p.firstKills}胜 / ${p.firstDeaths}负` },
          ],
          relatedRounds: [],
        }),
      );
    }

    // 5) 早死率
    if (p.deaths >= 8 && earlyRate > 0.45) {
      out.push(
        advice({
          player: p.name,
          category: "positioning",
          priority: earlyRate > 0.6 ? 1 : 2,
          title: "回合前 30 秒死亡率过高",
          description: `你有 ${(earlyRate * 100).toFixed(0)}% 的死亡发生在回合前 30 秒（共 ${earlyDeathRounds.length} 回合）。过早掉人会让队伍战术无法展开。建议：开局阶段优先保命拿信息，等道具就位后再做接触；CT 方不要每回合重复同一前压路线。`,
          evidence: [
            { label: "早死回合", value: `${earlyDeathRounds.length} / ${p.deaths} 次死亡` },
          ],
          relatedRounds: earlyDeathRounds.map((r) => r.round).slice(0, 6),
        }),
      );
    }

    // 6) 闪光配合（T 方视角近似）
    const pu = utility.find((u) => u.player === p.name);
    if (pu && nRounds >= 15 && p.startSide === "T") {
      const flashPerHalf = pu.flashAssists + pu.enemiesFlashed / 4;
      if (pu.flashes > 0 && flashPerHalf < 2) {
        out.push(
          advice({
            player: p.name,
            category: "teamwork",
            priority: 2,
            title: "闪光弹利用率低，进攻缺乏闪光配合",
            description: `你投掷了 ${pu.flashes} 颗闪光，但闪光助攻仅 ${p.flashAssists} 次、闪白敌人 ${p.enemiesFlashed} 次。进攻时闪光应服务于队友进点：进点前爆点闪、反清闪，而不是随手丢。建议和固定队友约定「闪光信号」配合。`,
            evidence: [
              { label: "闪光助攻", value: String(p.flashAssists) },
              { label: "闪白敌人", value: String(p.enemiesFlashed) },
            ],
            relatedRounds: [],
          }),
        );
      }
      if (pu.flashes === 0 && pu.smokes === 0) {
        out.push(
          advice({
            player: p.name,
            category: "utility",
            priority: 3,
            title: "几乎不使用道具",
            description: `全场你没有引爆过闪光或烟雾记录。CS2 的道具是改变回合走向的核心资源。建议从基础烟位学起（如 Mirage 的 A 点烟、中路烟），每回合至少携带一颗闪光服务进点。`,
            evidence: [{ label: "道具伤害", value: String(p.utilityDamage) }],
            relatedRounds: [],
          }),
        );
      }
    }

    // 7) 残局
    if (p.clutchAttempts >= 3 && p.clutchWins / p.clutchAttempts < 0.34) {
      out.push(
        advice({
          player: p.name,
          category: "aim",
          priority: 3,
          title: "残局转化率偏低",
          description: `你经历了 ${p.clutchAttempts} 次残局（队友全灭），仅赢下 ${p.clutchWins} 次。残局关键是拆分 1v1：利用掩体隔离枪线、制造假信息（假下包/静步换位）、把时间变成你的队友。`,
          evidence: [
            {
              label: "残局",
              value: `${p.clutchWins} / ${p.clutchAttempts}`,
              ref: `${((p.clutchWins / p.clutchAttempts) * 100).toFixed(0)}% 胜率`,
            },
          ],
          relatedRounds: [],
        }),
      );
    }
  }

  // ---- 团队级：经济决策审计 ----
  const badForceRounds: number[] = [];
  for (let i = 0; i < rounds.length - 1; i++) {
    const r = rounds[i];
    const next = rounds[i + 1];
    // 强起输了且下回合全队eco
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

  // 按优先级排序
  return out.sort((a, b) => a.priority - b.priority);
}
