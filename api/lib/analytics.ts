// 从原始 demo 数据计算结构化分析结果（记分板/回合/经济/热力/道具）
import type {
  AnalysisResult,
  BuyType,
  CoachAdvice,
  EvidenceItem,
  HeatPoint,
  MatchInfo,
  PlayerStat,
  RoundEvent,
  RoundSummary,
  Side,
  UtilityStats,
} from "../../contracts/analysis";
import { MAP_CALIBRATION, MAP_DISPLAY } from "../../contracts/analysis";
import type { RawDemoData, RawKill } from "./demoParser";
import { generateCoachAdvice } from "./coach";

const TICK_RATE = 64; // CS2 subtick demo 按 64 tick 近似
const TEAM_T = 2;
const TEAM_CT = 3;

function classifyBuy(teamEquip: number): BuyType {
  if (teamEquip <= 0) return "unknown";
  if (teamEquip < 6000) return "full_eco";
  if (teamEquip < 14000) return "semi";
  if (teamEquip < 19000) return "force";
  return "full_buy";
}

function winReasonOf(
  roundEvents: { event: string }[],
  reason?: number,
): RoundSummary["winReason"] {
  if (roundEvents.some((e) => e.event === "bomb_exploded"))
    return "bomb_exploded";
  if (roundEvents.some((e) => e.event === "bomb_defused")) return "bomb_defused";
  if (reason === 12) return "time";
  if (reason === 1) return "bomb_exploded";
  if (reason === 7) return "bomb_defused";
  if (reason === 8 || reason === 9) return "elimination";
  return "elimination";
}

/** 世界坐标 → 0-1 雷达坐标 */
function toRadar(
  map: string,
  x?: number,
  y?: number,
): { x: number; y: number } | null {
  if (x === undefined || y === undefined) return null;
  const cal = MAP_CALIBRATION[map];
  if (!cal) return null;
  const px = (x - cal.posX) / cal.scale;
  const py = (cal.posY - y) / cal.scale;
  if (px < 0 || px > 1024 || py < 0 || py > 1024) return null;
  return { x: px / 1024, y: py / 1024 };
}

export function analyzeDemo(
  raw: RawDemoData,
  fileName?: string,
): AnalysisResult {
  const mapName = raw.mapName || "unknown";
  const displayMap = MAP_DISPLAY[mapName] ?? mapName;

  // ---- 玩家基础 ----
  const byName = new Map<string, { steamid: string; teamNum?: number }>();
  for (const p of raw.players)
    byName.set(p.name, { steamid: p.steamid, teamNum: p.teamNumber });
  for (const s of raw.finalStats) {
    if (!byName.has(s.name))
      byName.set(s.name, { steamid: s.steamid, teamNum: s.teamNum });
    else {
      const e = byName.get(s.name)!;
      e.teamNum = e.teamNum ?? s.teamNum;
    }
  }
  // 兜底：从击杀事件补充玩家
  for (const k of raw.kills) {
    if (k.attackerName && !byName.has(k.attackerName))
      byName.set(k.attackerName, { steamid: k.attackerSteamid ?? "" });
    if (k.userName && !byName.has(k.userName))
      byName.set(k.userName, { steamid: k.userSteamid ?? "" });
  }
  const playerNames = [...byName.keys()].filter(Boolean);
  const teamNumOf = (name: string) => byName.get(name)?.teamNum;
  const startSideOf = (name: string): Side =>
    teamNumOf(name) === TEAM_CT ? "CT" : "T";

  // ---- 回合骨架 ----
  const starts = raw.roundEvents
    .filter((e) => e.event === "round_start" && !e.isWarmup)
    .sort((a, b) => a.tick - b.tick);
  // reason 16 (GameStart) 是技术重开信号，不计为已完成回合
  const ends = raw.roundEvents
    .filter((e) => e.event === "round_end" && !e.isWarmup && e.reason !== 16)
    .sort((a, b) => a.tick - b.tick);
  // 回合数以 round_end 为准（与比分一致）；kills 的 round 编号来自
  // total_rounds_played，在部分服务器上含热身/间隙编号，不能用来定总回合。
  const roundsTotal = ends.length;

  // 回合边界 tick（用于把事件归入回合）
  const startTicks = starts.map((s) => s.tick);
  const roundAtTick = (tick: number): number => {
    let r = 0;
    for (let i = 0; i < startTicks.length; i++) {
      if (tick >= startTicks[i]) r = i + 1;
      else break;
    }
    return r;
  };

  // 经济：freeze_end tick 与回合一一对应
  const freezeTicks = raw.roundEvents
    .filter((e) => e.event === "round_freeze_end" && !e.isWarmup)
    .sort((a, b) => a.tick - b.tick)
    .map((e) => e.tick + 1);
  const ecoByRound: { valueT: number; valueCT: number }[] = [];
  freezeTicks.forEach((ft, idx) => {
    const rows = raw.ecoTicks.filter((r) => r.tick === ft);
    const valueT = rows
      .filter((r) => r.teamNum === TEAM_T)
      .reduce((a, r) => a + (r.equipValue ?? 0), 0);
    const valueCT = rows
      .filter((r) => r.teamNum === TEAM_CT)
      .reduce((a, r) => a + (r.equipValue ?? 0), 0);
    ecoByRound[idx] = { valueT, valueCT };
  });

  // 击杀按回合分组
  const killsByRound = new Map<number, RawKill[]>();
  for (const k of raw.kills) {
    const r = k.round || roundAtTick(k.tick);
    if (!killsByRound.has(r)) killsByRound.set(r, []);
    killsByRound.get(r)!.push(k);
  }

  // ---- 逐回合汇总 ----
  const rounds: RoundSummary[] = [];
  let scoreT = 0;
  let scoreCT = 0;
  for (let r = 1; r <= roundsTotal; r++) {
    const end = ends[r - 1];
    const start = starts[r - 1];
    const evs = raw.roundEvents.filter(
      (e) =>
        e.round === r &&
        ["bomb_planted", "bomb_defused", "bomb_exploded", "round_mvp"].includes(
          e.event,
        ),
    );
    const winnerNum = end?.winner;
    const winner: Side =
      winnerNum === TEAM_CT ? "CT" : winnerNum === TEAM_T ? "T" : "T";
    if (winnerNum === TEAM_T) scoreT++;
    else if (winnerNum === TEAM_CT) scoreCT++;

    const eco = ecoByRound[r - 1] ?? { valueT: 0, valueCT: 0 };
    const startTick = start?.tick ?? 0;

    const events: RoundEvent[] = [];
    for (const k of killsByRound.get(r) ?? []) {
      events.push({
        t: Math.max(0, (k.tick - startTick) / TICK_RATE),
        type: "kill",
        actor: k.attackerName ?? undefined,
        victim: k.userName ?? undefined,
        weapon: k.weapon,
        headshot: k.headshot,
        side: k.attackerName ? startSideOf(k.attackerName) : undefined,
      });
    }
    for (const e of evs) {
      const t = Math.max(0, (e.tick - startTick) / TICK_RATE);
      if (e.event === "bomb_planted")
        events.push({ t, type: "plant", actor: e.userName ?? undefined });
      if (e.event === "bomb_defused")
        events.push({ t, type: "defuse", actor: e.userName ?? undefined });
      if (e.event === "bomb_exploded") events.push({ t, type: "explode" });
    }
    events.sort((a, b) => a.t - b.t);

    const buyT = classifyBuy(eco.valueT);
    const buyCT = classifyBuy(eco.valueCT);

    // 关键回合判定
    let isKeyRound = false;
    let keyReason: string | undefined;
    if (r === 1 || r === 13) {
      isKeyRound = true;
      keyReason = "手枪局";
    } else if (scoreT === 12 || scoreCT === 12) {
      isKeyRound = true;
      keyReason = "赛点局";
    } else if (
      (winner === "T" && (buyT === "full_eco" || buyT === "semi") && buyCT === "full_buy") ||
      (winner === "CT" && (buyCT === "full_eco" || buyCT === "semi") && buyT === "full_buy")
    ) {
      isKeyRound = true;
      keyReason = "eco 翻盘";
    }

    rounds.push({
      round: r,
      winner,
      winReason: winReasonOf(evs, end?.reason),
      scoreT,
      scoreCT,
      durationSec:
        end && start ? Math.max(5, (end.tick - start.tick) / TICK_RATE) : 0,
      mvpName: evs.find((e) => e.event === "round_mvp")?.userName ?? undefined,
      equipValueT: eco.valueT,
      equipValueCT: eco.valueCT,
      buyTypeT: buyT,
      buyTypeCT: buyCT,
      events,
      isKeyRound,
      keyReason,
    });
  }

  // ---- 坏习惯证据（全部由真实事件推导，含下包后存活统计） ----
  const evidence: EvidenceItem[] = [];
  const perPlayerIssue = new Map<string, number>();
  const pushEvidence = (item: EvidenceItem, cap = 3) => {
    const key = `${item.playerId}:${item.issue}`;
    const n = perPlayerIssue.get(key) ?? 0;
    if (n >= cap) return;
    perPlayerIssue.set(key, n + 1);
    evidence.push(item);
  };
  const steamOf = (name: string | null | undefined): string =>
    (name && byName.get(name)?.steamid) || "";
  const sideOfTeam = (teamNum?: number): Side | undefined =>
    teamNum === TEAM_CT ? "CT" : teamNum === TEAM_T ? "T" : undefined;
  const killSpot = (k: RawKill): string =>
    k.userX != null && k.userY != null
      ? `(${Math.round(k.userX)}, ${Math.round(k.userY)})`
      : "unknown";

  const postPlantStat = new Map<
    string,
    { rounds: number; survived: number }
  >();

  const TRADE_TICKS = 5 * TICK_RATE;
  const sortedKillsByRound = new Map<number, RawKill[]>();
  for (let r = 1; r <= roundsTotal; r += 1) {
    sortedKillsByRound.set(
      r,
      [...(killsByRound.get(r) ?? [])].sort((a, b) => a.tick - b.tick),
    );
  }
  // victim 死后 5 秒内队友击杀凶手 = 交易成立
  const findAvenger = (rk: RawKill[], victim: RawKill): RawKill | null => {
    const victimTeam = teamNumOf(victim.userName ?? "");
    if (!victim.attackerName || !victimTeam) return null;
    for (const k of rk) {
      if (k.tick <= victim.tick) continue;
      if (k.tick - victim.tick > TRADE_TICKS) break;
      if (
        k.userSteamid === victim.attackerSteamid &&
        teamNumOf(k.attackerName ?? "") === victimTeam
      ) {
        return k;
      }
    }
    return null;
  };

  for (let r = 1; r <= roundsTotal; r += 1) {
    const rk = sortedKillsByRound.get(r) ?? [];
    if (!rk.length) continue;
    const startTick = starts[r - 1]?.tick ?? 0;
    const tOf = (tick: number) => Math.max(0, (tick - startTick) / TICK_RATE);
    const first = rk[0];

    // 1) 首死且无交易
    if (
      first.userName &&
      first.attackerSteamid &&
      first.attackerSteamid !== first.userSteamid &&
      teamNumOf(first.userName) !== undefined &&
      !findAvenger(rk, first)
    ) {
      pushEvidence(
        {
          id: `ev_r${r}_first`,
          playerId: steamOf(first.userName),
          playerName: first.userName,
          round: r,
          t: tOf(first.tick),
          location: killSpot(first),
          issue: "solo_first_death",
          label: "无补枪首死",
          description: `${first.userName} 拿到本回合第一滴血，5 秒内队友没有完成补枪。`,
          severity: "high",
          side: sideOfTeam(teamNumOf(first.userName)),
        },
        99,
      );
    }

    // 2) 其他死亡未被补（死亡时至少还有 1 名队友存活）
    for (const k of rk) {
      if (k === first) continue;
      if (!k.userName || !k.attackerSteamid || k.attackerSteamid === k.userSteamid)
        continue;
      const victimTeam = teamNumOf(k.userName);
      if (victimTeam === undefined) continue;
      if (findAvenger(rk, k)) continue;
      const matesDead = rk.filter(
        (x) =>
          x.tick < k.tick && teamNumOf(x.userName ?? "") === victimTeam,
      ).length;
      if (matesDead >= 4) continue;
      pushEvidence({
        id: `ev_r${r}_spacing_${k.tick}`,
        playerId: steamOf(k.userName),
        playerName: k.userName,
        round: r,
        t: tOf(k.tick),
        location: killSpot(k),
        issue: "trade_spacing_review",
        label: "死亡未被补枪",
        description: `${k.userName} 死亡后 5 秒内队友没有补掉凶手，建议复盘补枪距离与跟进时机。`,
        severity: "low",
        side: sideOfTeam(victimTeam),
      });
    }

    // 3) 下包后存活统计 + 人数领先时下包后 8 秒内早死且输局
    const plant = raw.roundEvents.find(
      (e) =>
        e.event === "bomb_planted" &&
        !e.isWarmup &&
        roundAtTick(e.tick) === r &&
        e.userName,
    );
    if (plant?.userName) {
      const plantTeam = teamNumOf(plant.userName);
      if (plantTeam !== undefined) {
        const enemyTeam = plantTeam === TEAM_T ? TEAM_CT : TEAM_T;
        const deadBeforePlant = new Set<string>();
        for (const k of rk) {
          if (k.tick >= plant.tick) break;
          if (k.userName && teamNumOf(k.userName) === plantTeam)
            deadBeforePlant.add(k.userName);
        }
        const plantSide: Side = plantTeam === TEAM_T ? "T" : "CT";
        for (const p of playerNames) {
          if (teamNumOf(p) !== plantTeam) continue;
          if (deadBeforePlant.has(p)) continue;
          const st = postPlantStat.get(p) ?? { rounds: 0, survived: 0 };
          st.rounds += 1;
          const diedAfter = rk.some(
            (k) => k.tick > plant.tick && k.userName === p,
          );
          if (!diedAfter) st.survived += 1;
          postPlantStat.set(p, st);
        }
        const alivePlant = 5 - deadBeforePlant.size;
        let aliveEnemy = 5;
        for (const k of rk) {
          if (k.tick >= plant.tick) break;
          if (k.userName && teamNumOf(k.userName) === enemyTeam) aliveEnemy -= 1;
        }
        if (alivePlant > aliveEnemy && rounds[r - 1]?.winner !== plantSide) {
          for (const k of rk) {
            if (k.tick <= plant.tick) continue;
            if (k.tick - plant.tick > 8 * TICK_RATE) break;
            if (!k.userName) continue;
            if (teamNumOf(k.userName) !== plantTeam) continue;
            if (!k.attackerSteamid || k.attackerSteamid === k.userSteamid) continue;
            pushEvidence({
              id: `ev_r${r}_postplant_${k.tick}`,
              playerId: steamOf(k.userName),
              playerName: k.userName,
              round: r,
              t: tOf(k.tick),
              location: killSpot(k),
              issue: "post_plant_overpeek",
              label: "下包后过早死亡",
              description: `${k.userName} 在人数领先时下包，随后 ${(
                (k.tick - plant.tick) /
                TICK_RATE
              ).toFixed(1)} 秒内死亡，且该回合最终告负。`,
              severity: "high",
              side: plantSide,
            });
          }
        }
      }
    }
  }

  // 4) 队友闪光（致盲 >= 1.5s）
  for (const g of raw.grenadeEvents) {
    if (g.event !== "player_blind" || !g.attackerName || !g.userName) continue;
    if ((g.blindDuration ?? 0) < 1.5) continue;
    const aT = teamNumOf(g.attackerName);
    const uT = teamNumOf(g.userName);
    if (aT === undefined || aT !== uT) continue;
    const round = roundAtTick(g.tick);
    const startTick = starts[round - 1]?.tick ?? 0;
    pushEvidence({
      id: `ev_r${round}_flash_${g.tick}`,
      playerId: steamOf(g.attackerName),
      playerName: g.attackerName,
      round,
      t: Math.max(0, (g.tick - startTick) / TICK_RATE),
      location: "道具爆点",
      issue: "team_flash",
      label: "闪到队友",
      description: `${g.attackerName} 的闪光致盲队友 ${g.userName} ${(g.blindDuration ?? 0).toFixed(1)} 秒。`,
      severity: "mid",
      side: sideOfTeam(aT),
    });
  }

  // 5) 经济断层：同队有人全起(>=4000) 且至少两人接近 eco(<=1500)
  freezeTicks.forEach((ft, idx) => {
    const rows = raw.ecoTicks.filter(
      (x) => x.tick === ft && x.teamNum !== undefined && x.name,
    );
    const byTeam = new Map<number, typeof rows>();
    for (const row of rows) {
      const list = byTeam.get(row.teamNum!) ?? [];
      list.push(row);
      byTeam.set(row.teamNum!, list);
    }
    for (const [teamNum, list] of byTeam) {
      if (list.length < 3) continue;
      const sorted = [...list].sort(
        (a, b) => (a.equipValue ?? 0) - (b.equipValue ?? 0),
      );
      if ((sorted[sorted.length - 1].equipValue ?? 0) - (sorted[0].equipValue ?? 0) < 2500)
        continue;
      const high = sorted.find((x) => (x.equipValue ?? 0) >= 4000);
      const lowCount = sorted.filter((x) => (x.equipValue ?? 0) <= 1500).length;
      if (!high || lowCount < 2) continue;
      pushEvidence(
        {
          id: `ev_r${idx + 1}_eco_${teamNum}`,
          playerId: String(high.steamid || high.name),
          playerName: high.name,
          round: idx + 1,
          t: 0,
          location: "freeze time",
          issue: "economy_mismatch",
          label: "经济决策不统一",
          description: `${high.name} 所在阵营本回合有人全起、至少两人接近 eco，建议冻结时间统一 call。`,
          severity: "mid",
          side: sideOfTeam(teamNum),
        },
        99,
      );
    }
  });

  // 6) 重复死亡点位（仅当 demo 录制了坐标）
  const deathGrid = new Map<string, number>();
  for (let r = 1; r <= roundsTotal; r += 1) {
    const startTick = starts[r - 1]?.tick ?? 0;
    for (const k of sortedKillsByRound.get(r) ?? []) {
      if (!k.userSteamid || k.userX == null || k.userY == null) continue;
      const key = `${k.userSteamid}|${Math.round(k.userX / 500)}|${Math.round(k.userY / 500)}`;
      const n = (deathGrid.get(key) ?? 0) + 1;
      deathGrid.set(key, n);
      if (n === 3 && k.userName) {
        pushEvidence({
          id: `ev_grid_${key.replace(/\|/g, "_")}`,
          playerId: steamOf(k.userName),
          playerName: k.userName,
          round: r,
          t: Math.max(0, (k.tick - startTick) / TICK_RATE),
          location: killSpot(k),
          issue: "repeat_death_position",
          label: "重复死亡点位",
          description: `${k.userName} 在同一区域重复死亡（本场第 3 次），建议改变站位或接触方式。`,
          severity: "mid",
          side: sideOfTeam(teamNumOf(k.userName)),
        });
      }
    }
  }


  // ---- 个人统计 ----
  const finalByName = new Map(raw.finalStats.map((s) => [s.name, s]));
  const tradeKillCount: Record<string, number> = {};
  const tradedDeathCount: Record<string, number> = {};
  const players: PlayerStat[] = playerNames.map((name) => {
    const fs = finalByName.get(name);
    const kills = raw.kills.filter((k) => k.attackerName === name);
    const deaths = raw.kills.filter((k) => k.userName === name);
    const assists = raw.kills.filter(
      (k) => k.assisterName === name && k.attackerName !== name,
    );
    const dmg = raw.hurts
      .filter((h) => h.attackerName === name)
      .reduce((a, h) => a + (h.dmgHealth ?? 0), 0);
    const nRounds = Math.max(roundsTotal, 1);

    // KAST：击杀/助攻/存活/被补枪（traded 5 秒内击杀者死亡）
    let kastRounds = 0;
    for (let r = 1; r <= nRounds; r++) {
      const rk = killsByRound.get(r) ?? [];
      const hadKill = rk.some((k) => k.attackerName === name);
      const hadAssist = rk.some((k) => k.assisterName === name);
      const died = rk.find((k) => k.userName === name);
      let avengerName: string | null = null;
      if (died?.attackerName) {
        const avenger = rk.find(
          (k) =>
            k.userName === died.attackerName &&
            k.tick - died.tick > 0 &&
            k.tick - died.tick <= 5 * TICK_RATE,
        );
        avengerName = avenger?.attackerName ?? null;
      }
      const traded = !!avengerName;
      if (avengerName) {
        tradeKillCount[avengerName] = (tradeKillCount[avengerName] ?? 0) + 1;
      }
      if (died && traded) {
        tradedDeathCount[name] = (tradedDeathCount[name] ?? 0) + 1;
      }
      if (hadKill || hadAssist || !died || traded) kastRounds++;
    }

    // 首杀对枪
    let firstKills = 0;
    let firstDeaths = 0;
    for (const [, rk] of killsByRound) {
      if (!rk.length) continue;
      const first = rk.reduce((a, b) => (a.tick <= b.tick ? a : b));
      if (first.attackerName === name) firstKills++;
      if (first.userName === name) firstDeaths++;
    }

    // 残局：队友全部阵亡后仍存活的尝试
    let clutchAttempts = 0;
    let clutchWins = 0;
    for (let r = 1; r <= nRounds; r++) {
      const rk = [...(killsByRound.get(r) ?? [])].sort(
        (a, b) => a.tick - b.tick,
      );
      const myTeamNum = teamNumOf(name);
      if (myTeamNum === undefined) continue;
      const teammates = playerNames.filter(
        (p) => p !== name && teamNumOf(p) === myTeamNum,
      );
      const enemies = playerNames.filter(
        (p) => teamNumOf(p) !== undefined && teamNumOf(p) !== myTeamNum,
      );
      if (!teammates.length || !enemies.length) continue;
      const deadSet = new Set<string>();
      let becameLast = false;
      for (const k of rk) {
        if (k.userName) deadSet.add(k.userName);
        if (
          !deadSet.has(name) &&
          teammates.every((t) => deadSet.has(t)) &&
          enemies.some((e) => !deadSet.has(e))
        ) {
          becameLast = true;
          break;
        }
        if (k.userName === name) break; // 已阵亡，非残局主角
      }
      if (becameLast) {
        clutchAttempts++;
        const winnerNum = ends[r - 1]?.winner;
        if (winnerNum === myTeamNum) clutchWins++;
      }
    }

    // 多杀回合
    let multiKillRounds = 0;
    const killsPerRound: number[] = [];
    for (let r = 1; r <= nRounds; r++) {
      const c = (killsByRound.get(r) ?? []).filter(
        (k) => k.attackerName === name,
      ).length;
      killsPerRound.push(c);
      if (c >= 2) multiKillRounds++;
    }

    const killsN = fs?.kills ?? kills.length;
    const deathsN = fs?.deaths ?? deaths.length;
    const assistsN = fs?.assists ?? assists.length;
    const adr = nRounds ? (fs?.damage ?? dmg) / nRounds : 0;
    const kast = nRounds ? (kastRounds / nRounds) * 100 : 0;
    const hsKills = fs?.hsKills ?? kills.filter((k) => k.headshot).length;
    const kpr = killsN / nRounds;
    const dpr = deathsN / nRounds;
    const apr = assistsN / nRounds;
    const impact = 2.13 * kpr + 0.42 * apr - 0.41;
    const rating =
      0.0073 * kast +
      0.3591 * kpr -
      0.5329 * dpr +
      0.2372 * impact +
      0.0032 * adr +
      0.1587;

    const weaponKills: Record<string, number> = {};
    for (const k of kills) {
      const w = k.weapon ?? "unknown";
      weaponKills[w] = (weaponKills[w] ?? 0) + 1;
    }

    return {
      steamid: byName.get(name)?.steamid ?? "",
      name,
      teamName: startSideOf(name) === "T" ? "T 阵营" : "CT 阵营",
      startSide: startSideOf(name),
      kills: killsN,
      deaths: deathsN,
      assists: assistsN,
      kd: deathsN ? killsN / deathsN : killsN,
      adr: Math.round(adr * 10) / 10,
      kast: Math.round(kast * 10) / 10,
      hsPercent: killsN ? Math.round((hsKills / killsN) * 1000) / 10 : 0,
      firstKills,
      firstDeaths,
      openingDuelWinRate:
        firstKills + firstDeaths
          ? Math.round((firstKills / (firstKills + firstDeaths)) * 1000) / 10
          : 0,
      tradeKills: tradeKillCount[name] ?? 0,
      tradedDeaths: tradedDeathCount[name] ?? 0,
      postPlantRounds: postPlantStat.get(name)?.rounds ?? 0,
      postPlantSurvivalRounds: postPlantStat.get(name)?.survived ?? 0,
      clutchAttempts,
      clutchWins,
      multiKillRounds,
      mvps: fs?.mvps ?? 0,
      score: fs?.score ?? 0,
      rating: Math.max(0.1, Math.round(rating * 100) / 100),
      flashAssists: kills.filter((k) => k.flashAssist).length,
      enemiesFlashed: fs?.enemiesFlashed ?? 0,
      utilityDamage: fs?.utilDamage ?? 0,
      weaponKills,
      killsPerRound,
    };
  });

  // ---- 热力图点 ----
  const heat: HeatPoint[] = [];
  for (const k of raw.kills) {
    const d = toRadar(mapName, k.userX, k.userY);
    if (d && k.userName)
      heat.push({
        ...d,
        kind: "death",
        side: startSideOf(k.userName),
        player: k.userName,
        round: k.round,
      });
    const a = toRadar(mapName, k.attackerX, k.attackerY);
    if (a && k.attackerName)
      heat.push({
        ...a,
        kind: "kill",
        side: startSideOf(k.attackerName),
        player: k.attackerName,
        round: k.round,
      });
  }
  // 首杀热点
  for (const [, rk] of killsByRound) {
    if (!rk.length) continue;
    const first = rk.reduce((a, b) => (a.tick <= b.tick ? a : b));
    const p = toRadar(mapName, first.userX, first.userY);
    if (p)
      heat.push({
        ...p,
        kind: "firstkill",
        player: first.userName ?? undefined,
        round: first.round,
      });
  }
  // 道具爆点
  for (const g of raw.grenadeEvents) {
    if (!g.event.includes("detonate") && g.event !== "inferno_startburn")
      continue;
    const p = toRadar(mapName, g.x, g.y);
    if (p)
      heat.push({
        ...p,
        kind: "utility",
        player: g.userName ?? undefined,
        round: g.round,
      });
  }

  // ---- 道具统计 ----
  const utility: UtilityStats[] = playerNames.map((name) => {
    const detonates = raw.grenadeEvents.filter(
      (g) => g.userName === name && g.event.includes("detonate"),
    );
    const blinds = raw.grenadeEvents.filter(
      (g) => g.event === "player_blind" && g.attackerName === name,
    );
    const pStat = players.find((p) => p.name === name)!;
    return {
      player: name,
      flashes: detonates.filter((g) => g.event === "flashbang_detonate")
        .length,
      smokes: detonates.filter((g) => g.event === "smokegrenade_detonate")
        .length,
      molotovs: detonates.filter((g) => g.event === "molotov_detonate").length,
      hes: detonates.filter((g) => g.event === "hegrenade_detonate").length,
      flashAssists: pStat.flashAssists,
      enemiesFlashed: pStat.enemiesFlashed,
      avgBlindDuration: blinds.length
        ? Math.round(
            (blinds.reduce((a, b) => a + (b.blindDuration ?? 0), 0) /
              blinds.length) *
              100,
          ) / 100
        : 0,
      utilityDamage: pStat.utilityDamage,
    };
  });

  // ---- 经济曲线 ----
  const economy = rounds.map((r, i) => ({
    round: r.round,
    valueT: ecoByRound[i]?.valueT ?? r.equipValueT,
    valueCT: ecoByRound[i]?.valueCT ?? r.equipValueCT,
  }));

  const match: MatchInfo = {
    id: 0, // 由路由层填
    mapName,
    displayMap,
    teamTName: "T 阵营",
    teamCTName: "CT 阵营",
    scoreT,
    scoreCT,
    roundsTotal,
    durationSec: Math.round(raw.lastTick / TICK_RATE),
    playedAt: new Date().toISOString(),
    source: "upload",
    fileName,
  };

  const coach: CoachAdvice[] = generateCoachAdvice({
    players,
    rounds,
    utility,
    heat,
    economy,
  });

  return { match, players, rounds, heat, utility, coach, economy, evidence };
}
