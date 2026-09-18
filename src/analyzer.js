import { createId, unique } from "./util.js";
import { issueLibrary } from "./parser.js";

const HABIT_FIXES = {
  solo_first_death: {
    severity: "高",
    fix: "默认控图阶段只在队友能补枪或能给闪时扩大接触面，第一接触后优先退回可交易位置。",
    training: "两人一组练默认控图，接触前报可补枪距离，目标是首死后 5 秒内可交易。"
  },
  repeat_peek: {
    severity: "中",
    fix: "同一角度被发现后不要马上二次 peek，改用换位、等闪或让队友补位。",
    training: "练习 connector、short、A ramp 的一次接触后换位路线，每轮只允许无道具 repeek 一次。"
  },
  repeat_death_position: {
    severity: "中",
    fix: "先复盘该点位每次死亡前的队友距离、道具和枪线；确认原因相同后再改变站位或接触方式。",
    training: "针对重复死亡点位做三种处理：等闪、换位、双人补枪，并记录哪种能减少重复死亡。"
  },
  low_value_utility: {
    severity: "中",
    fix: "把烟闪绑定到进点时间，不单独提前交关键道具；交道具后必须有队友利用窗口。",
    training: "固定 3 套 Mirage 爆弹 timing，记录闪光致盲敌人和队友的数量。"
  },
  team_flash: {
    severity: "中",
    fix: "进点闪先报落点和爆点，队友确认背闪后再出；近点清不干净时不要深闪封自己。",
    training: "A ramp、palace、short 三个点位做 10 分钟背闪配合，要求队友不白且能出枪。"
  },
  post_plant_overpeek: {
    severity: "高",
    fix: "先核对下包后早死时是否有人可交易；若属于孤立主动接触，再改为先建立交叉火力。",
    training: "A 点和 B 点各练 3 套 post-plant 站位，要求每个站位都有至少一个可互补角度。"
  },
  slow_rotate: {
    severity: "中",
    fix: "拿到爆弹信息后及时压缩无效架点，第一名回防队员负责等队友和道具，不单人硬清。",
    training: "复盘每个回防起跑时间，目标是确认爆弹后 8 秒内进入可支援区域。"
  },
  economy_mismatch: {
    severity: "中",
    fix: "冻结时间由一个人统一 call buy/save/force，半起局优先保证关键闪烟和同一进攻计划。",
    training: "每局 freeze time 做 5 秒经济确认，记录是否出现 2 人以上装备断层。"
  },
  late_execute: {
    severity: "高",
    fix: "默认控图如果没有拿到明确击杀或信息，45 秒前必须决定集合点，避免 20 秒以下才开始爆弹。",
    training: "练 1:10、0:55、0:40 三个进攻决策节点，每个节点必须有明确下一步 call。"
  },
  trade_spacing_review: {
    severity: "低",
    fix: "把这类死亡逐个复盘最近队友距离、可交易角度和 5 秒内补枪窗口；只有重复出现才当作稳定坏习惯处理。",
    training: "两人默认控图练习，接触前报补枪位，死亡后由队友立刻复述是否能交易。"
  }
};

const ROLE_REASONS = {
  "aggressive opener": {
    primary: "Second entry",
    secondary: "Entry",
    reason: "第一接触次数高，但无补枪死亡也偏多；更适合跟在第一枪位后交易，而不是长期单人开路。"
  },
  "utility support": {
    primary: "Support",
    secondary: "Second entry",
    reason: "道具参与度和闪光数据高，适合负责关键烟闪，并在 entry 后立刻补枪。"
  },
  "space lurker": {
    primary: "Lurker",
    secondary: "Rotator",
    reason: "边路接触和断后事件多，但需要降低无信息单摸；适合承担有明确退路的边路控图。"
  },
  "site anchor": {
    primary: "Anchor",
    secondary: "Clutcher",
    reason: "包点相关事件和残局参与多，适合做稳定防守点，但回防 timing 需要更早。"
  },
  "late round caller": {
    primary: "IGL tendency",
    secondary: "Support",
    reason: "经济和执行时间相关事件多，适合负责中后期决策，但需要更早统一经济和进攻时间。"
  },
  "trade rifler": {
    primary: "Second entry",
    secondary: "Support",
    reason: "本场补枪击杀占比较高，更适合作为第二枪位；这不等同于已证明具备长期 lurk 或指挥能力。"
  },
  "low-contact rifler": {
    primary: "Support",
    secondary: "Rotator",
    reason: "本场第一接触占比较低，暂时更适合从支援和补位角色观察；demo 数据不足以直接判定 Anchor 或 Lurker。"
  },
  "balanced rifler": {
    primary: "Second entry",
    secondary: "Support",
    reason: "本场第一接触、补枪和道具参与没有单项形成明显极值，先采用通用步枪位建议。"
  }
};

export function buildReport(parsedDemo, selection) {
  const match = parsedDemo.match;
  if (!match.map || match.map === "unknown") {
    throw new Error(`Unsupported map for analysis: ${match.map || "unknown"}.`);
  }
  const selectedIds = unique(selection.teamPlayerIds || []);
  if (selectedIds.length !== 5) {
    throw new Error("Exactly five team players must be selected.");
  }
  if (!selectedIds.includes(selection.focusPlayerId)) {
    throw new Error("Focus player must be one of the selected team players.");
  }

  const selectedPlayers = selectedIds.map((id) => findPlayer(match, id));
  const selectedTeamIds = unique(selectedPlayers.map((player) => player.teamId));
  if (selectedTeamIds.length !== 1) {
    throw new Error("Selected players must belong to the same team.");
  }
  const focusPlayer = findPlayer(match, selection.focusPlayerId);
  const targetRole = normalizeTargetRole(selection.targetRole);
  const selectedEvidence = match.evidence.filter((item) => selectedIds.includes(item.playerId));
  const overview = buildOverview(match, selectedPlayers, selectedEvidence);
  const personalReports = selectedPlayers.map((player) => buildPersonalReport(match, player, targetRole));
  const teamReport = buildTeamReport(match, selectedPlayers, selectedEvidence);
  const keyRounds = buildKeyRounds(match, selectedIds);
  const tactics = match.map === "Mirage"
    ? buildTactics(match, selectedPlayers, personalReports, selectedEvidence)
    : buildGeneralTactics(match, selectedPlayers, personalReports, selectedEvidence);
  const trainingPlan = buildTrainingPlan(personalReports, teamReport, match);

  return {
    id: createId("report"),
    createdAt: new Date().toISOString(),
    uploadId: parsedDemo.upload.id,
    analysisMode: parsedDemo.parser.mode,
    parser: parsedDemo.parser,
    match: {
      id: match.id,
      map: match.map,
      score: match.score,
      roundsPlayed: match.roundsPlayed,
      durationMinutes: match.durationMinutes,
      sideWinRates: match.sideWinRates,
      teams: match.teams
    },
    selectedTeam: selectedPlayers.map(summaryPlayer),
    focusPlayer: summaryPlayer(focusPlayer),
    targetRole,
    overview,
    personalReports,
    teamReport,
    keyRounds,
    tactics,
    trainingPlan,
    evidenceCount: selectedEvidence.length,
    caveat: buildParserCaveat(parsedDemo.parser)
  };
}

function buildParserCaveat(parser) {
  if (parser?.sample) {
    return "这是独立生成的产品样例，不代表任何真实 demo；真实上传不会自动降级到这套数据。";
  }
  if (parser?.fallback) {
    return `当前报告使用 deterministic Mirage fallback 生成，因为真实解析器不可用：${parser.fallbackReason}`;
  }
  if (parser?.mode === "real-demo-parser") {
    return `当前报告来自外部真实 demo parser：${parser.name}。`;
  }
  return "当前解析器是可替换的 Mirage 确定性证据适配器，用于验证 PRD 闭环；生产环境应接入 demoinfocs-golang 解析真实 tick 和事件。";
}

function buildOverview(match, players, evidence) {
  const teamId = players[0]?.teamId;
  const issueCounts = countBy(evidence, "issue");
  const biggestIssue = Object.entries(issueCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const biggestIssueLabel = biggestIssue
    ? evidence.find((item) => item.issue === biggestIssue)?.label || issueLibrary.find((item) => item.issue === biggestIssue)?.label || biggestIssue
    : "暂无明显重复失误";
  const turningRounds = rankKeyRounds(match, players.map((player) => player.id))
    .slice(0, 3)
    .map((round) => ({
      round: round.number,
      result: round.result,
      tags: round.tags,
      reason: roundReason(round)
    }));
  const won = match.rounds.filter((round) => round.winnerTeamId === teamId).length;
  const played = match.rounds.length;
  const summary = evidence.length
    ? `这场 ${match.map} 共 ${played} 回合，己方赢 ${won} 局。规则引擎标出 ${evidence.length} 条可复盘证据，${biggestIssueLabel}的证据最多（${issueCounts[biggestIssue] || 0} 条）。`
    : `这场 ${match.map} 共 ${played} 回合，己方赢 ${won} 局。未发现足够重复的高置信度失误，建议先看关键回合时间线。`;
  const best = pickBest(players, "adr");
  return {
    summary,
    biggestProblem: biggestIssue
      ? `${biggestIssueLabel}有 ${issueCounts[biggestIssue]} 条证据，是本场最值得先复核的点。`
      : "本场没有足够重复的负面证据，避免过度解读单回合。",
    biggestStrength: `${best.name} 的 ADR 为 ${best.stats.adr}，是本场更稳定的输出点。`,
    map: match.map,
    score: `${match.score.team_a}-${match.score.team_b}`,
    sideWinRates: match.sideWinRates,
    roundResults: match.rounds.map((round) => ({
      round: round.number,
      winner: round.winnerTeamId,
      side: round.winningSide,
      economy: round.economyType
    })),
    turningRounds,
    selectedPlayers: players.map((player) => player.name)
  };
}

function buildPersonalReport(match, player, targetRole) {
  const evidenceByIssue = groupBy(
    match.evidence.filter((item) => item.playerId === player.id),
    "issue"
  );
  const habits = Object.entries(evidenceByIssue)
    .filter(([, items]) => items.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || (HABIT_FIXES[b[0]]?.severity === "高" ? 1 : 0) - (HABIT_FIXES[a[0]]?.severity === "高" ? 1 : 0))
    .slice(0, 5)
    .map(([issue, items]) => {
      const template = issueLibrary.find((item) => item.issue === issue);
      const fix = HABIT_FIXES[issue] || HABIT_FIXES.solo_first_death;
      return {
        id: `habit_${player.id}_${issue}`,
        issue,
        title: items[0]?.label || template?.label || issue,
        severity: fix.severity,
        evidence: items.slice(0, 3).map(formatEvidence),
        specificFix: fix.fix,
        training: fix.training
      };
    });

  const roleInfo = ROLE_REASONS[player.profile] || ROLE_REASONS["balanced rifler"];
  return {
    player: summaryPlayer(player),
    stats: player.stats,
    habits,
    recommendedRoles: [roleInfo.primary, roleInfo.secondary],
    roleReason: `单场临时建议：${roleInfo.reason} 关键指标：opening duel win rate ${player.stats.openingDuelWinRate}，trade kill rate ${player.stats.tradeKillRate}，有道具收益回合率 ${player.stats.utilityEffectiveness}。需结合多场 demo 再确定长期角色。`,
    targetRoleFit: buildTargetRoleFit(player, roleInfo, targetRole),
    keyRounds: match.evidence
      .filter((item) => item.playerId === player.id)
      .slice(0, 3)
      .map((item) => ({ round: item.round, time: item.time, issue: item.label }))
  };
}

function buildTeamReport(match, players, evidence) {
  const teamId = players[0]?.teamId;
  const openingProblems = evidence.filter((item) => item.issue === "solo_first_death").length;
  const utilityProblems = evidence.filter((item) => ["low_value_utility", "team_flash", "late_execute"].includes(item.issue)).length;
  const postPlantProblems = evidence.filter((item) => item.issue === "post_plant_overpeek").length;
  const tradeProblems = evidence.filter((item) => item.issue === "trade_spacing_review").length;
  const situation = computeSituationWinRates(match, teamId);
  const weakArea = mostCommonLocation(evidence) || "（证据不足以定位区域）";
  const issueCountsByPlayer = countBy(evidence, "playerId");
  const reviewPlayer = [...players].sort((a, b) => (issueCountsByPlayer[b.id] || 0) - (issueCountsByPlayer[a.id] || 0))[0];
  const roleAllocation = players.map((player) => {
    const info = ROLE_REASONS[player.profile] || ROLE_REASONS["balanced rifler"];
    return {
      player: player.name,
      primaryRole: info.primary,
      secondaryRole: info.secondary,
      basis: info.reason
    };
  });
  const tRounds = match.rounds.filter((round) => round.sideByTeam?.[teamId] === "T");
  const tWins = tRounds.filter((round) => round.winnerTeamId === teamId).length;
  const openingOnT = evidence.filter((item) => item.issue === "solo_first_death" && item.side === "T").length;
  const strengths = [];
  const weaknesses = [];
  if (numericStat(pickBest(players, "adr").stats.adr) >= 80) strengths.push(`${pickBest(players, "adr").name} ADR ${pickBest(players, "adr").stats.adr}，是稳定输出点`);
  if (situation.postPlant !== "n/a" && parsePercent(situation.postPlant) >= 55) strengths.push(`下包后胜率 ${situation.postPlant}`);
  if (openingProblems === 0) strengths.push("本场没有重复的无补枪首死");
  if (!strengths.length) strengths.push("能打满回合并保留完整击杀/经济数据，具备继续复盘的基础");
  if (openingProblems >= 3) weaknesses.push(`无补枪首死 ${openingProblems} 次`);
  if (tradeProblems >= 3) weaknesses.push(`补枪距离问题 ${tradeProblems} 次`);
  if (postPlantProblems >= 2) weaknesses.push(`下包后人数领先时 8 秒内早死 ${postPlantProblems} 次`);
  if (utilityProblems >= 3) weaknesses.push(`道具协同问题 ${utilityProblems} 次`);
  if (!weaknesses.length) weaknesses.push("没有形成高频坏习惯，优先看关键回合而不是标签");

  return {
    style: `仅凭事件流无法可靠判断快攻或慢控风格；可确认的是 T 方 ${tWins}/${tRounds.length || 0} 胜，无补枪首死 ${openingOnT} 次。`,
    tSideDependency: openingOnT >= 3
      ? "T 方对单人第一接触依赖偏高，首死后容易在战术展开前少人。"
      : "T 方没有明显的单人开路依赖。",
    ctRotation: evidence.filter((item) => item.issue === "slow_rotate").length
      ? "CT 方存在回防过慢证据，需要明确谁先补位、谁留点拖延。"
      : "本场没有足够的回防过慢证据，不把过早转点当结论。",
    stableOutput: pickBest(players, "adr").name,
    pressurePoint: (issueCountsByPlayer[reviewPlayer?.id] || 0) >= 2
      ? `${reviewPlayer.name}（${issueCountsByPlayer[reviewPlayer.id]} 条重复证据，非单看 K/D）`
      : "无足够重复证据，不指定单一突破口",
    weakArea,
    fragileSituation: postPlantProblems > 1 ? "下包后人数优势局" : openingProblems > 1 ? "默认控图首死后的 4v5" : "尚不构成单一脆弱局势",
    utilityCoordination: utilityProblems >= 4 ? `不足，道具问题 ${utilityProblems} 次。` : utilityProblems ? `一般，道具问题 ${utilityProblems} 次。` : "本场没有高频道具失误。",
    economyDiscipline: evidence.some((item) => item.issue === "economy_mismatch") ? "存在不同步强起，建议固定 freeze time 经济 call。" : "本场没有明显的经济断层证据。",
    roleAllocation,
    strengths,
    weaknesses,
    situationWinRates: situation
  };
}

function buildKeyRounds(match, selectedIds) {
  return rankKeyRounds(match, selectedIds).slice(0, 5).map((round) => {
    const selectedEvents = round.events
      .filter((event) => ["kill", "c4", "evidence"].includes(event.type) && (selectedIds.includes(event.playerId) || event.type === "c4" || event.relatedPlayerIds?.some((id) => selectedIds.includes(id))))
      .slice(0, 8);
    return {
      id: `key_round_${round.number}`,
      round: round.number,
      result: round.result,
      tags: round.tags,
      title: keyRoundTitle(round),
      timeline: selectedEvents.map((event) => ({
        time: event.time,
        location: event.location,
        event: event.description,
        player: event.playerName
      })),
      mainMistake: mainMistakeForTags(round.tags),
      betterPlay: betterPlayForTags(round.tags),
      relatedPlayers: unique(selectedEvents.flatMap((event) => event.relatedPlayerIds?.length ? event.relatedPlayerIds : [event.playerId])).filter((id) => selectedIds.includes(id))
    };
  });
}

function buildTactics(match, players, personalReports, evidence) {
  const roleMap = mapPlayersToTacticRoles(players, personalReports);
  const evidenceNotes = evidence.slice(0, 6).map(formatEvidence);
  return [
    {
      id: "tactic_t_mid_a_split",
      name: "Mirage T 方中路控图转 A 夹击",
      map: match.map,
      side: "T",
      economyCondition: "长枪局，有 3 烟 2 闪以上",
      objective: "用双人中路降低单走首死，把补枪强点放到 connector，再和 A ramp/palace 同步夹 A。",
      assignments: [
        assignment(roleMap.secondEntry, "second entry", "跟中路第一枪位，负责 connector 补枪后夹 A"),
        assignment(roleMap.support, "support", "window smoke、connector smoke、出 A 前反清闪"),
        assignment(roleMap.lurker, "palace pressure", "不单摸 B，改为 palace 后点牵制并等同步"),
        assignment(roleMap.entry, "entry", "A ramp 第一接触，吃闪后进 triple/default"),
        assignment(roleMap.caller, "late-round cover", "断 B 小前压，0:55 前 call 是否集合")
      ],
      openingSetup: "两人 top mid，一人 underpass，一人 A ramp，一人 palace；中路烟闪后不单人过点。",
      utility: ["window smoke", "connector smoke", "top connector flash", "stairs smoke", "jungle smoke"],
      timing: "1:25 开始中路控图，0:55 前决定转 A，0:45 第一波爆弹。",
      contingency: "中路首人掉且无法补枪时，立即收回 A ramp/palace 做慢夹，不继续 dry peek connector。",
      whyFits: `${roleMap.support.name} 的道具参与度适合做关键烟闪，${roleMap.secondEntry.name} 的补枪角色比单独首接更稳，${roleMap.lurker.name} 不再承担高风险单摸。`,
      evidence: evidenceNotes.slice(0, 2)
    },
    {
      id: "tactic_t_b_apps_pop",
      name: "Mirage T 方 B 小默认控图转 B 爆弹",
      map: match.map,
      side: "T",
      economyCondition: "长枪或半起，有 B apps 控制和两颗进点闪",
      objective: "减少 A ramp 反复 peek，把边路接触变成双人可交易控图，再用短时间爆 B。",
      assignments: [
        assignment(roleMap.entry, "entry", "B apps 吃闪出点，优先清 van 和 bench"),
        assignment(roleMap.secondEntry, "second entry", "贴近 entry 600 units 内，第一时间补 van/market"),
        assignment(roleMap.support, "support", "market window smoke、短闪、出点第二颗高闪"),
        assignment(roleMap.lurker, "mid hold", "控 short 信息，不单人深摸 market"),
        assignment(roleMap.caller, "late lurk cover", "留 top mid 防前压，0:50 call 集合")
      ],
      openingSetup: "两人 B apps，一人 top mid，一人 underpass，一人 T spawn 断后；B apps 不提前暴露全队人数。",
      utility: ["market window smoke", "bench molotov", "site flash", "short flash"],
      timing: "1:20 拿 B apps，0:58 让中路制造声音，0:48 B apps 爆点。",
      contingency: "B apps 被反清时，不硬换人；退回 default，保留烟闪改打中路夹 A。",
      whyFits: `这套把${roleMap.entry.name}的第一接触放到有闪光保护的位置，并让${roleMap.secondEntry.name}承担即时交易，避免 PRD 中提到的无补枪首死。`,
      evidence: evidenceNotes.slice(2, 4)
    },
    {
      id: "tactic_ct_mid_default",
      name: "Mirage CT 方稳中路默认防守",
      map: match.map,
      side: "CT",
      economyCondition: "长枪局或有 AWP 的常规防守",
      objective: "固定中路信息链，避免过早转点；A/B 两边以拖延和回防路线为核心。",
      assignments: [
        assignment(roleMap.anchor, "A anchor", "A 点单人拖延，保留 smoke/molly 到 0:55 后"),
        assignment(roleMap.rotator, "connector rotator", "听中路信息，第一时间补 connector 或 jungle"),
        assignment(roleMap.support, "short support", "short 闪反清 top mid，负责回防补烟"),
        assignment(roleMap.entry, "B anchor", "B apps 首接后退到可补枪位，不深追"),
        assignment(roleMap.caller, "information caller", "统一转点 call，要求第二信息确认后再大规模轮转")
      ],
      openingSetup: "1A anchor、1 connector、1 short、1 B anchor、1 flexible market；前 35 秒不双人离开同一包点。",
      utility: ["top mid molotov", "connector smoke", "B apps molotov", "A ramp delay smoke"],
      timing: "1:30 抢第一信息，1:05 前不盲目三人转点，0:45 根据包点压力决定回防。",
      contingency: "中路丢失时 connector 不单人反清，等 short 闪或 jungle 队友补位后再拿回信息。",
      whyFits: `队伍证据显示回防和过早转点都影响胜率，因此用${roleMap.caller.name}固定信息确认，用${roleMap.anchor.name}保留拖延道具。`,
      evidence: evidenceNotes.slice(4, 6)
    },
    {
      id: "tactic_eco_half_buy_mid_crunch",
      name: "Mirage eco/半起中路夹击策略",
      map: match.map,
      side: "Both",
      economyCondition: "eco、半起或只有 2-3 把长枪",
      objective: "把低经济局变成一次集中的信息和补枪赌博，不分散送枪，也不在无道具时慢性掉人。",
      assignments: [
        assignment(roleMap.entry, "first contact", "拿最差枪位先接触，负责吸引火力和报点"),
        assignment(roleMap.secondEntry, "trade rifle", "保存最好武器，贴近第一接触完成补枪"),
        assignment(roleMap.support, "utility carrier", "保留唯一烟闪，等集结后再交"),
        assignment(roleMap.lurker, "sound bait", "制造边路脚步后立即回收，不单人深摸"),
        assignment(roleMap.caller, "stack caller", "冻结时间决定夹击区域，失败后 call 保枪")
      ],
      openingSetup: "低经济 T 方三人靠 top mid/underpass，A ramp 一人造声后回收；CT 方可三人中路夹、一人 A 拖延、一人 B 保枪位。",
      utility: ["one pop flash", "connector smoke or top mid smoke", "close molotov if available", "dropped pistol/armor priority for trade rifle"],
      timing: "1:32 集中站位，1:18 交唯一关键道具，1:15 同步接触，不拖到默认末段。",
      contingency: "第一波没有击杀时立刻回收最好武器；拿到击杀时五人转最近包点，不分散捡枪。",
      whyFits: `队伍有经济不同步和默认阶段无交易首死证据，因此低经济局需要由${roleMap.caller.name}统一 call，并让${roleMap.secondEntry.name}保留最好武器做即时交易。`,
      evidence: evidenceNotes.slice(0, 2)
    }
  ];
}

function buildGeneralTactics(match, players, personalReports, evidence) {
  const roleMap = mapPlayersToTacticRoles(players, personalReports);
  const evidenceNotes = evidence.slice(0, 8).map(formatEvidence);
  const openingCount = evidence.filter((item) => item.issue === "solo_first_death").length;
  const tradeCount = evidence.filter((item) => item.issue === "trade_spacing_review").length;
  const utilityCount = evidence.filter((item) => item.issue === "team_flash").length;
  const evidenceReason = evidence.length
    ? `本场共 ${evidence.length} 条证据，其中无补枪首死 ${openingCount} 次、补枪距离问题 ${tradeCount} 次、队友白 ${utilityCount} 次。`
    : "本场没有足够的高置信度坏习惯证据，因此采用低风险、可交易的基础方案。";
  return [
    {
      id: "tactic_t_trade_default",
      name: `${match.map} T 方双人可交易默认`,
      map: match.map,
      side: "T",
      economyCondition: "长枪局或可用道具完整的半起局",
      objective: "所有第一接触都由双人完成，先拿信息再根据空区决定最终包点。",
      assignments: [
        assignment(roleMap.entry, "first contact", "负责第一个可撤退接触，不在无闪时深追"),
        assignment(roleMap.secondEntry, "trade", "保持可补枪距离，第一枪位接触后立即跟进"),
        assignment(roleMap.support, "support", "保存关键烟闪，收到最终 call 后再交"),
        assignment(roleMap.lurker, "map control", "控一条边路并保留退路，不在队友无法支援时深摸"),
        assignment(roleMap.caller, "caller", "在 0:55 前根据人数和信息确定集合点")
      ],
      openingSetup: "两组双人拿信息，一人负责中后期 call；第一接触前确认谁能补枪。",
      utility: ["第一接触闪", "关键 choke 烟", "进点高闪", "下包后拖延道具"],
      timing: "前 35 秒拿安全信息，0:55 前决定集合，0:40 前开始最终执行。",
      contingency: "首人掉且不能交易时立即回收，不继续向同一枪线补送。",
      whyFits: evidenceReason,
      evidence: evidenceNotes.slice(0, 2)
    },
    {
      id: "tactic_t_compact_execute",
      name: `${match.map} T 方紧凑爆弹`,
      map: match.map,
      side: "T",
      economyCondition: "至少两烟两闪，五人枪械结构接近",
      objective: "缩短爆弹与进点间隔，保证道具窗口内至少两人同步接触。",
      assignments: [
        assignment(roleMap.entry, "entry", "吃第一颗闪进入包点并报近点"),
        assignment(roleMap.secondEntry, "second entry", "贴近 entry，优先完成即时交易"),
        assignment(roleMap.support, "utility", "负责封关键回防口和第二颗进点闪"),
        assignment(roleMap.lurker, "late flank", "只做短距离牵制，爆弹前回到可支援范围"),
        assignment(roleMap.caller, "post-plant caller", "下包后统一收缩与交叉火力位置")
      ],
      openingSetup: "三人执行组、一路短牵制、一人负责后路；不同时在三条路线单独找人。",
      utility: ["回防口烟", "近点燃烧弹", "第一进点闪", "第二进点闪"],
      timing: "第一颗进点道具后 3 秒内接触，关键烟落地后 8 秒内完成进点。",
      contingency: "关键烟失败时暂停进点，等第二套道具或转向另一包点。",
      whyFits: `${roleMap.support.name} 负责道具，${roleMap.secondEntry.name} 固定跟进，减少本场的孤立接触。`,
      evidence: evidenceNotes.slice(2, 4)
    },
    {
      id: "tactic_ct_information_chain",
      name: `${match.map} CT 方信息链防守`,
      map: match.map,
      side: "CT",
      economyCondition: "常规长枪局",
      objective: "每个包点保留一名拖延者，转点只在获得第二条信息后发生。",
      assignments: [
        assignment(roleMap.anchor, "anchor", "保留拖延道具，第一接触后退回可存活位置"),
        assignment(roleMap.rotator, "rotator", "负责第一轮补位，不在单一信息下彻底放空另一点"),
        assignment(roleMap.support, "support", "为队友提供反清闪和回防烟"),
        assignment(roleMap.entry, "contact defender", "拿第一信息后不深追，等待补位"),
        assignment(roleMap.caller, "information caller", "统一确认人数、包和道具信息再 call 转点")
      ],
      openingSetup: "两点各保留拖延者，其余三人组成可互相支援的信息链。",
      utility: ["首轮拖延烟", "反清闪", "回防烟", "拆包保护道具"],
      timing: "前 35 秒只拿低风险信息；确认三人以上或 C4 后再大规模转点。",
      contingency: "信息丢失时优先收缩交叉火力，不单人反清未知区域。",
      whyFits: "只基于击杀、阵营与已有证据安排低风险防守，不推断语音和真实意图。",
      evidence: evidenceNotes.slice(4, 6)
    },
    {
      id: "tactic_low_buy_group",
      name: `${match.map} eco/半起集中策略`,
      map: match.map,
      side: "Both",
      economyCondition: "eco、半起或装备结构不统一",
      objective: "集中有限枪械和道具制造一次可交易接触，避免分散送枪。",
      assignments: [
        assignment(roleMap.entry, "first contact", "拿低价值武器先接触并报点"),
        assignment(roleMap.secondEntry, "trade rifle", "保留全队最好武器完成补枪"),
        assignment(roleMap.support, "utility carrier", "集中使用唯一关键烟闪"),
        assignment(roleMap.lurker, "sound bait", "只造声后回收，不深摸"),
        assignment(roleMap.caller, "economy caller", "冻结时间统一 buy/save/force 决策")
      ],
      openingSetup: "至少三人集中，最好武器处于第二枪位。",
      utility: ["唯一关键闪", "封枪线烟", "近点燃烧弹（如有）", "捡枪掩护"],
      timing: "开局 20 秒内完成集结，一次同步接触；失败后保留最好武器。",
      contingency: "第一波没有击杀就回收，不分散捡枪或逐个补送。",
      whyFits: evidence.some((item) => item.issue === "economy_mismatch")
        ? "本场存在经济不同步证据，低经济局应由一人统一 call。"
        : "即使没有经济失误证据，集中策略也比五人分散接触更易执行。",
      evidence: evidenceNotes.slice(6, 8)
    }
  ];
}

function buildTrainingPlan(personalReports, teamReport, match) {
  const repeatedHabits = countBy(personalReports.flatMap((report) => report.habits), "issue");
  const topHabits = Object.entries(repeatedHabits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([issue]) => issue);

  const tasks = topHabits.map((issue, index) => {
    const fix = HABIT_FIXES[issue] || HABIT_FIXES.solo_first_death;
    return {
      id: `training_${issue}`,
      title: `${index + 1}. ${issueLibrary.find((item) => item.issue === issue)?.label || issue}`,
      objective: fix.fix,
      drill: fix.training,
      successMetric: successMetricForIssue(issue)
    };
  });

  tasks.push({
    id: "training_team_tactics",
    title: `${tasks.length + 1}. 五人战术复盘`,
    objective: "用推荐战术跑 6 个训练回合，记录每次失败是否来自 timing、补枪距离或道具断档。",
    drill: `${match.map} 选择两个包点执行各练 15 分钟，结束后只复盘有证据的失败点。`,
    successMetric: "每套战术连续 3 次执行时，关键烟闪和第一补枪都按计划完成。"
  });

  return {
    focus: teamReport.fragileSituation,
    weekPlan: tasks
  };
}

function normalizeTargetRole(role) {
  const allowed = [
    "Auto",
    "Entry",
    "Second entry",
    "Support",
    "Lurker",
    "AWPer",
    "Anchor",
    "Rotator",
    "Clutcher",
    "IGL tendency"
  ];
  return allowed.includes(role) ? role : "Auto";
}

function buildTargetRoleFit(player, roleInfo, targetRole) {
  if (targetRole === "Auto") {
    return "未指定目标位置，系统按本场证据自动推荐角色。";
  }
  if ([roleInfo.primary, roleInfo.secondary].includes(targetRole)) {
    return `${targetRole} 与 ${player.name} 的本场证据匹配，可以作为下一阶段重点训练方向。`;
  }
  return `${targetRole} 不是 ${player.name} 当前最稳的证据推荐；如果要转向这个位置，优先修正报告中的高严重度习惯。`;
}

function mapPlayersToTacticRoles(players, reports) {
  const byRole = {};
  reports.forEach((report) => {
    const player = players.find((candidate) => candidate.id === report.player.id);
    report.recommendedRoles.forEach((role) => {
      if (!byRole[role]) byRole[role] = player;
    });
  });

  return {
    entry: byRole.Entry || players[0],
    secondEntry: byRole["Second entry"] || players[1] || players[0],
    support: byRole.Support || players[2] || players[0],
    lurker: byRole.Lurker || players[3] || players[0],
    anchor: byRole.Anchor || players[3] || players[0],
    rotator: byRole.Rotator || players[4] || players[0],
    caller: byRole["IGL tendency"] || players[4] || players[0]
  };
}

function rankKeyRounds(match, selectedIds) {
  const scored = match.rounds
    .filter((round) => (round.events || []).some((event) => selectedIds.includes(event.playerId) || event.relatedPlayerIds?.some((id) => selectedIds.includes(id))))
    .map((round) => {
      const tags = round.tags || [];
      let score = 0;
      if (tags.includes("advantage_throw")) score += 5;
      if (tags.includes("post_plant_failure")) score += 4;
      if (tags.includes("opening_death_swing")) score += 3;
      if (tags.includes("economy_swing")) score += 2;
      if (tags.includes("key_round")) score += 1;
      score += (round.events || []).filter((event) => event.type === "evidence" && selectedIds.includes(event.playerId)).length;
      return { round, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.round.number - b.round.number);
  return scored.map((item) => item.round);
}

function computeSituationWinRates(match, teamId) {
  const playersById = Object.fromEntries((match.players || []).map((player) => [player.id, player]));
  const teamOf = (playerId) => playersById[playerId]?.teamId;
  let fiveVFour = { win: 0, play: 0 };
  let fourVThree = { win: 0, play: 0 };
  let postPlant = { win: 0, play: 0 };
  let eco = { win: 0, play: 0 };
  let forceBuy = { win: 0, play: 0 };

  for (const round of match.rounds || []) {
    const alive = {};
    for (const player of match.players || []) {
      if (player.teamId === "team_a" || player.teamId === "team_b") {
        alive[player.teamId] = Math.min(5, (alive[player.teamId] || 0) + 1);
      }
    }
    let sawFiveVFour = false;
    let sawFourVThree = false;
    let planted = false;
    for (const event of round.events || []) {
      if (event.type === "c4" && /planted/i.test(event.description || "")) planted = true;
      if (event.type !== "kill") continue;
      const victimId = event.relatedPlayerIds?.[0];
      const victimTeam = teamOf(victimId);
      if (victimTeam && alive[victimTeam] > 0) alive[victimTeam] -= 1;
      const us = alive[teamId] || 0;
      const them = alive[teamId === "team_a" ? "team_b" : "team_a"] || 0;
      if (us === 5 && them === 4) sawFiveVFour = true;
      if (us === 4 && them === 3) sawFourVThree = true;
    }
    const won = round.winnerTeamId === teamId;
    if (sawFiveVFour) {
      fiveVFour.play += 1;
      if (won) fiveVFour.win += 1;
    }
    if (sawFourVThree) {
      fourVThree.play += 1;
      if (won) fourVThree.win += 1;
    }
    if (planted && round.sideByTeam?.[teamId] === "T") {
      postPlant.play += 1;
      if (won) postPlant.win += 1;
    }
    const selectedBuy = classifyBuyValue(round.economy?.[teamId]);
    if (selectedBuy === "eco") {
      eco.play += 1;
      if (won) eco.win += 1;
    }
    if (selectedBuy === "force buy") {
      forceBuy.play += 1;
      if (won) forceBuy.win += 1;
    }
  }

  const rate = (item) => (item.play ? percentRate(item.win, item.play) : "n/a");
  return {
    fiveVFour: rate(fiveVFour),
    fourVThree: rate(fourVThree),
    postPlant: rate(postPlant),
    eco: rate(eco),
    forceBuy: rate(forceBuy)
  };
}

function classifyBuyValue(value) {
  const equipment = Number(value);
  if (!Number.isFinite(equipment) || equipment <= 0) return "unknown";
  if (equipment < 6000) return "eco";
  if (equipment < 14000) return "half buy";
  if (equipment < 19000) return "force buy";
  return "full buy";
}

function percentRate(win, play) {
  return `${Math.round((win / Math.max(1, play)) * 100)}%`;
}

function parsePercent(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.endsWith("%")) return Number(value.slice(0, -1)) || 0;
  return 0;
}

function mostCommonLocation(evidence) {
  const counts = {};
  for (const item of evidence) {
    if (!item.location || item.location === "unknown" || item.location === "freeze time") continue;
    counts[item.location] = (counts[item.location] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function findPlayer(match, id) {
  const player = match.players.find((candidate) => candidate.id === id);
  if (!player) throw new Error(`Unknown player: ${id}`);
  return player;
}

function summaryPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    teamId: player.teamId,
    profile: player.profile,
    stats: player.stats
  };
}

function formatEvidence(item) {
  return {
    round: item.round,
    time: item.time,
    location: item.location,
    event: item.description,
    issue: item.label
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key];
    if (!acc[value]) acc[value] = [];
    acc[value].push(item);
    return acc;
  }, {});
}

function pickBest(players, statKey) {
  return [...players].sort((a, b) => numericStat(b.stats[statKey]) - numericStat(a.stats[statKey]))[0] || players[0];
}

function pickWorst(players, statKey) {
  return [...players].sort((a, b) => numericStat(a.stats[statKey]) - numericStat(b.stats[statKey]))[0] || players[0];
}

function numericStat(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.endsWith("%")) return Number(value.slice(0, -1));
  return Number(value) || 0;
}

function assignment(player, role, duty) {
  return {
    player: player.name,
    playerId: player.id,
    role,
    duty
  };
}

function roundReason(round) {
  if (round.tags.includes("advantage_throw")) return "曾取得至少两人人数优势但最终失利；需要复盘后续死亡顺序和可交易位置。";
  if (round.tags.includes("post_plant_failure")) return "下包后人数领先时有人在 8 秒内死亡，且进攻方最终输掉回合。";
  if (round.tags.includes("economy_swing")) return "同队出现有人全起、至少两人接近 eco 的装备断层。";
  if (round.tags.includes("opening_death_swing")) return "首死时最近队友超过 800 units，且 5 秒内没有交易。";
  return "该回合包含多条可核对事件，请按时间线复盘。";
}

function keyRoundTitle(round) {
  if (round.tags.includes("advantage_throw")) return `第 ${round.number} 回合：人数优势局被拖入单挑`;
  if (round.tags.includes("post_plant_failure")) return `第 ${round.number} 回合：下包后处理失败`;
  if (round.tags.includes("economy_swing")) return `第 ${round.number} 回合：经济转折回合`;
  return `第 ${round.number} 回合：首死改变回合走向`;
}

function mainMistakeForTags(tags) {
  if (tags.includes("advantage_throw")) return "确认问题：至少两人人数优势最终被逆转；具体决策原因需结合时间线复盘。";
  if (tags.includes("post_plant_failure")) return "确认问题：下包后人数领先时出现 8 秒内早死，随后进攻方输局。";
  if (tags.includes("economy_swing")) return "确认问题：同队装备结构明显不统一。";
  if (tags.includes("late_execute")) return "确认问题：执行开始较晚，剩余操作时间不足。";
  if (tags.includes("opening_death_swing")) return "确认问题：首死距离队友过远，5 秒内无人交易。";
  return "没有足够规则证据给出单一失误结论。";
}

function betterPlayForTags(tags) {
  if (tags.includes("advantage_throw")) return "领先后减少孤立接触，优先占据能互相补枪的位置，并在下一次接触前确认人数。";
  if (tags.includes("post_plant_failure")) return "下包后先建立至少一组交叉火力，前 8 秒避免没有队友可交易的单独接触。";
  if (tags.includes("economy_swing")) return "冻结时间统一 call 全起、半起或 eco，确保有限的最好武器处于第二枪位。";
  if (tags.includes("opening_death_swing")) return "第一接触前让第二枪位进入 800 units 内，或等队友道具后再扩大接触面。";
  return "按事件时间线逐项确认可交易距离、道具窗口和人数变化。";
}

function successMetricForIssue(issue) {
  const metrics = {
    solo_first_death: "无交易首死减少到每半场 1 次以内。",
    repeat_peek: "同一角度无道具 repeek 死亡每场不超过 1 次。",
    repeat_death_position: "同一命名点位的重复死亡减少到每场 1 次以内。",
    low_value_utility: "关键闪光后 4 秒内至少一名队友利用窗口接触。",
    team_flash: "进点闪导致队友全白次数降到 0。",
    post_plant_overpeek: "下包后人数优势局胜率达到 70% 以上。",
    slow_rotate: "确认爆弹后首名回防队员 8 秒内到位。",
    economy_mismatch: "整场不出现 2 人以上经济结构断层。",
    late_execute: "T 方 0:45 前完成集合和最终进攻 call。"
  };
  return metrics[issue] || "每条建议都能绑定到具体回合证据并在训练后减少复发。";
}
