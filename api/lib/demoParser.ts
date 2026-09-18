// CS2 demo 解析封装（@laihoe/demoparser2，Rust 内核 Node 绑定）
// 懒加载 + 容错：原生模块加载失败时抛出友好错误，由路由层兜底。
import { createRequire as nodeCreateRequire } from "module";

const require = nodeCreateRequire(import.meta.url);

export interface RawKill {
  tick: number;
  round: number;
  attackerName: string | null;
  attackerSteamid: string | null;
  attackerX?: number;
  attackerY?: number;
  userName: string | null;
  userSteamid: string | null;
  userX?: number;
  userY?: number;
  weapon?: string;
  headshot?: boolean;
  assisterName?: string | null;
  flashAssist?: boolean;
  thrusmoke?: boolean;
}

export interface RawHurt {
  tick: number;
  round: number;
  attackerName: string | null;
  userName: string | null;
  dmgHealth?: number;
  hitgroup?: number;
  weapon?: string;
}

export interface RawRoundEvent {
  tick: number;
  event: string;
  round?: number;
  winner?: number; // team_num
  reason?: number;
  teamRoundsTotal?: number; // 随事件携带的比分（近似）
  userName?: string | null; // round_mvp 的 MVP / bomb 事件的操作者
  isWarmup?: boolean;
  site?: number;
  timelimit?: number;
}

export interface RawGrenadeEvent {
  tick: number;
  event: string;
  round?: number;
  userName?: string | null;
  attackerName?: string | null;
  blindDuration?: number;
  x?: number;
  y?: number;
}

export interface RawEcoTick {
  tick: number;
  name: string;
  steamid: string;
  teamNum?: number;
  equipValue?: number;
  balance?: number;
}

export interface RawPlayerStatRow {
  name: string;
  steamid: string;
  teamNum?: number;
  score?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  hsKills?: number;
  damage?: number;
  utilDamage?: number;
  enemiesFlashed?: number;
  mvps?: number;
}

export interface RawDemoData {
  mapName: string;
  players: { name: string; steamid: string; teamNumber?: number }[];
  kills: RawKill[];
  hurts: RawHurt[];
  roundEvents: RawRoundEvent[];
  grenadeEvents: RawGrenadeEvent[];
  ecoTicks: RawEcoTick[];
  finalStats: RawPlayerStatRow[];
  lastTick: number;
}

type ParserModule = {
  parseHeader: (p: string) => { map_name?: string };
  parsePlayerInfo: (
    p: string,
  ) => { name: string; steamid: string | number; team_number?: number }[];
  parseEvent: (
    p: string,
    ev: string,
    extraPlayer?: string[],
    extraOther?: string[],
  ) => Record<string, unknown>[];
  parseEvents: (
    p: string,
    evs: string[],
    extraPlayer?: string[],
    extraOther?: string[],
  ) => unknown;
  parseTicks: (
    p: string,
    props: string[],
    ticks?: number[],
    soa?: boolean,
  ) => Record<string, unknown>[] | Record<string, unknown[]>;
};

let cached: ParserModule | null = null;

function loadParser(): ParserModule {
  if (cached) return cached;
  try {
    cached = require("@laihoe/demoparser2") as ParserModule;
    return cached;
  } catch (e) {
    throw new Error(
      `demo 解析引擎加载失败（@laihoe/demoparser2 原生模块不可用）: ${(e as Error).message}`,
    );
  }
}

const num = (v: unknown): number | undefined =>
  v === null || v === undefined ? undefined : Number(v);
const str = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);
const bool = (v: unknown): boolean | undefined =>
  v === null || v === undefined ? undefined : Boolean(v);

/** 将 parseEvents 的返回值规整为行数组（兼容 {event: rows} 或数组形态） */
function rowsOf(parsed: unknown, event: string): Record<string, unknown>[] {
  if (Array.isArray(parsed)) {
    // 单事件时部分版本直接返回行数组
    return parsed as Record<string, unknown>[];
  }
  if (parsed && typeof parsed === "object") {
    const byEv = (parsed as Record<string, unknown>)[event];
    if (Array.isArray(byEv)) return byEv as Record<string, unknown>[];
    // 某些版本返回 [{event_name, ...row}]
    const all = Object.values(parsed as Record<string, unknown>).flat();
    if (Array.isArray(all)) {
      return (all as Record<string, unknown>[]).filter(
        (r) => !r.event_name || r.event_name === event,
      );
    }
  }
  return [];
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function parseDemoFile(path: string): RawDemoData {
  const parser = loadParser();

  const header = parser.parseHeader(path);
  const mapName = header.map_name ?? "unknown";

  const players = safe(
    () =>
      parser.parsePlayerInfo(path).map((p) => ({
        name: p.name,
        steamid: String(p.steamid),
        teamNumber: p.team_number,
      })),
    [] as RawDemoData["players"],
  );

  // 击杀事件（含双方坐标 / 武器 / 爆头 / 回合号）
  const killRows = safe(
    () =>
      parser.parseEvent(
        path,
        "player_death",
        ["X", "Y"],
        ["total_rounds_played"],
      ),
    [] as Record<string, unknown>[],
  );
  const kills: RawKill[] = killRows.map((r) => ({
    tick: Number(r.tick),
    round: Number(r.total_rounds_played ?? 0) + 1,
    attackerName: str(r.attacker_name),
    attackerSteamid: str(r.attacker_steamid),
    attackerX: num(r.attacker_X),
    attackerY: num(r.attacker_Y),
    userName: str(r.user_name),
    userSteamid: str(r.user_steamid),
    userX: num(r.user_X),
    userY: num(r.user_Y),
    weapon: str(r.weapon) ?? undefined,
    headshot: bool(r.headshot),
    assisterName: str(r.assister_name),
    flashAssist: bool(r.assistedflash),
    thrusmoke: bool(r.thrusmoke),
  }));

  // 伤害事件
  const hurtRows = safe(
    () => parser.parseEvent(path, "player_hurt", [], ["total_rounds_played"]),
    [] as Record<string, unknown>[],
  );
  const hurts: RawHurt[] = hurtRows.map((r) => ({
    tick: Number(r.tick),
    round: Number(r.total_rounds_played ?? 0) + 1,
    attackerName: str(r.attacker_name),
    userName: str(r.user_name),
    dmgHealth: num(r.dmg_health),
    hitgroup: num(r.hitgroup),
    weapon: str(r.weapon) ?? undefined,
  }));

  // 回合事件（单遍解析多类）
  const roundEventNames = [
    "round_start",
    "round_freeze_end",
    "round_end",
    "round_mvp",
    "bomb_planted",
    "bomb_defused",
    "bomb_exploded",
  ];
  const roundParsed = safe(
    () =>
      parser.parseEvents(path, roundEventNames, [], [
        "total_rounds_played",
        "is_warmup_period",
        "team_rounds_total",
      ]),
    {},
  );
  const roundEvents: RawRoundEvent[] = roundEventNames.flatMap((ev) =>
    rowsOf(roundParsed, ev)
      .filter((r) => !r.event_name || r.event_name === ev)
      .map((r) => ({
      tick: Number(r.tick),
      event: ev,
      round:
        r.total_rounds_played !== undefined
          ? Number(r.total_rounds_played) + (ev === "round_start" ? 1 : 0)
          : undefined,
      winner: num(r.winner),
      reason: num(r.reason),
      teamRoundsTotal: num(r.team_rounds_total),
      userName: str(r.user_name),
      isWarmup: bool(r.is_warmup_period),
      site: num(r.site),
      timelimit: num(r.timelimit),
    })),
  );

  // 道具事件
  const nadeEventNames = [
    "flashbang_detonate",
    "smokegrenade_detonate",
    "hegrenade_detonate",
    "molotov_detonate",
    "inferno_startburn",
    "player_blind",
  ];
  const nadeParsed = safe(
    () =>
      parser.parseEvents(
        path,
        nadeEventNames,
        ["X", "Y"],
        ["total_rounds_played"],
      ),
    {},
  );
  const grenadeEvents: RawGrenadeEvent[] = nadeEventNames.flatMap((ev) =>
    rowsOf(nadeParsed, ev)
      .filter((r) => !r.event_name || r.event_name === ev)
      .map((r) => ({
      tick: Number(r.tick),
      event: ev,
      round:
        r.total_rounds_played !== undefined
          ? Number(r.total_rounds_played) + 1
          : undefined,
      userName: str(r.user_name),
      attackerName: str(r.attacker_name),
      blindDuration: num(r.blind_duration),
      x: num(r.user_X),
      y: num(r.user_Y),
    })),
  );

  // 经济快照：freeze_end 帧的装备价值
  const freezeTicks = roundEvents
    .filter((e) => e.event === "round_freeze_end")
    .map((e) => e.tick + 1);
  const ecoRows = safe(
    () =>
      freezeTicks.length
        ? (parser.parseTicks(
            path,
            ["current_equip_value", "balance", "team_num"],
            freezeTicks,
          ) as Record<string, unknown>[])
        : [],
    [] as Record<string, unknown>[],
  );
  const ecoTicks: RawEcoTick[] = (Array.isArray(ecoRows) ? ecoRows : []).map(
    (r) => ({
      tick: Number(r.tick),
      name: str(r.name) ?? "",
      steamid: str(r.steamid) ?? "",
      teamNum: num(r.team_num),
      equipValue: num(r.current_equip_value),
      balance: num(r.balance),
    }),
  );

  // 终局统计快照
  const lastTick = kills.length
    ? Math.max(...kills.map((k) => k.tick))
    : (roundEvents.at(-1)?.tick ?? 0);
  const statRows = safe(
    () =>
      lastTick > 0
        ? (parser.parseTicks(
            path,
            [
              "score",
              "kills_total",
              "deaths_total",
              "assists_total",
              "headshot_kills_total",
              "damage_total",
              "utility_damage_total",
              "enemies_flashed_total",
              "mvps",
              "team_num",
            ],
            [lastTick],
          ) as Record<string, unknown>[])
        : [],
    [] as Record<string, unknown>[],
  );
  const finalStats: RawPlayerStatRow[] = (
    Array.isArray(statRows) ? statRows : []
  ).map((r) => ({
    name: str(r.name) ?? "",
    steamid: str(r.steamid) ?? "",
    teamNum: num(r.team_num),
    score: num(r.score),
    kills: num(r.kills),
    deaths: num(r.deaths),
    assists: num(r.assists),
    hsKills: num(r.headshot_kills_total),
    damage: num(r.damage_total),
    utilDamage: num(r.utility_damage_total),
    enemiesFlashed: num(r.enemies_flashed_total),
    mvps: num(r.mvps),
  }));

  return {
    mapName,
    players,
    kills,
    hurts,
    roundEvents,
    grenadeEvents,
    ecoTicks,
    finalStats,
    lastTick,
  };
}
