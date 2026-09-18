import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseDemo } from "./parser.js";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 4 * 60 * 1000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PARSER_BIN = path.resolve(__dirname, "..", "bin", "cs2-demoparser");

export async function parseUploadedDemo(upload, options = {}) {
  const realParser = configuredParser(options);
  const allowFallback = shouldAllowFallback(upload, options);

  if (!realParser) {
    if (allowFallback) {
      return syntheticFallback(upload, "CS2_DEMO_PARSER_BIN is not configured.");
    }
    throw new Error("Real demo parser is not configured.");
  }

  try {
    const parsed = await runRealParser(realParser, upload);
    validateParsedDemo(parsed);
    return {
      ...parsed,
      parser: {
        ...parsed.parser,
        name: parsed.parser?.name || "external-dem-parser",
        mode: "real-demo-parser",
        fallback: false
      },
      upload: {
        id: upload.id,
        originalName: upload.originalName,
        size: upload.size,
        sha256: upload.sha256
      }
    };
  } catch (error) {
    if (options.requireRealParser === true || process.env.CS2_DEMO_PARSER_REQUIRED === "true" || !allowFallback) {
      throw new Error(`Real demo parser failed: ${error.message}`);
    }
    return syntheticFallback(upload, error.message);
  }
}

function shouldAllowFallback(upload, options = {}) {
  if (options.allowFallback === true) return true;
  return process.env.CS2_DEMO_PARSER_ALLOW_FALLBACK === "true";
}

function configuredParser(options = {}) {
  const bin = Object.hasOwn(options, "parserBin")
    ? options.parserBin
    : process.env.CS2_DEMO_PARSER_BIN || defaultParserBin();
  if (!bin) return null;
  return {
    bin,
    timeoutMs: Number(options.timeoutMs || process.env.CS2_DEMO_PARSER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  };
}

function defaultParserBin() {
  return fs.existsSync(DEFAULT_PARSER_BIN) ? DEFAULT_PARSER_BIN : "";
}

async function runRealParser(parser, upload) {
  const isJavaScript = parser.bin.endsWith(".js") || parser.bin.endsWith(".mjs") || parser.bin.endsWith(".cjs");
  const command = isJavaScript ? process.execPath : parser.bin;
  const args = isJavaScript ? [parser.bin, upload.storedPath] : [upload.storedPath];
  const { stdout, stderr } = await execFileAsync(command, args, {
    timeout: parser.timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...parserEnvironment(),
      CS2_DEMO_UPLOAD_ID: upload.id,
      CS2_DEMO_ORIGINAL_NAME: upload.originalName,
      CS2_DEMO_SHA256: upload.sha256,
      CS2_DEMO_SIZE: String(upload.size)
    }
  });

  try {
    return JSON.parse(stdout);
  } catch (error) {
    const stderrText = String(stderr || "").trim();
    const detail = stderrText ? ` stderr: ${stderrText.slice(0, 500)}` : "";
    throw new Error(`Parser stdout was not valid JSON: ${error.message}.${detail}`);
  }
}

function parserEnvironment() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_TEST_WORKER_ID;
  return env;
}

function syntheticFallback(upload, reason) {
  const parsed = parseDemo(upload);
  return {
    ...parsed,
    parser: {
      ...parsed.parser,
      mode: "synthetic-fallback",
      fallback: true,
      fallbackReason: reason
    }
  };
}

export function validateParsedDemo(parsed) {
  assertObject(parsed, "parsed demo");
  assertObject(parsed.parser, "parser");
  assertObject(parsed.match, "match");
  assertString(parsed.match.id, "match.id");
  assertString(parsed.match.map, "match.map");
  assertObject(parsed.match.score, "match.score");
  assertNumber(parsed.match.score.team_a, "match.score.team_a");
  assertNumber(parsed.match.score.team_b, "match.score.team_b");
  assertArray(parsed.match.players, "match.players");
  assertArray(parsed.match.rounds, "match.rounds");
  assertArray(parsed.match.evidence, "match.evidence");

  const validTeams = new Set(["team_a", "team_b"]);
  const playerIds = new Set();
  const teamCounts = { team_a: 0, team_b: 0 };
  parsed.match.players.forEach((player, index) => {
    const prefix = `match.players[${index}]`;
    assertString(player.id, `${prefix}.id`);
    assertString(player.name, `${prefix}.name`);
    assertString(player.teamId, `${prefix}.teamId`);
    assertObject(player.stats, `${prefix}.stats`);
    if (!validTeams.has(player.teamId)) {
      throw new Error(`${prefix}.teamId must be team_a or team_b.`);
    }
    if (playerIds.has(player.id)) {
      throw new Error(`${prefix}.id must be unique.`);
    }
    playerIds.add(player.id);
    teamCounts[player.teamId] += 1;
  });
  if (teamCounts.team_a < 5 || teamCounts.team_b < 5) {
    throw new Error(`match.players must include at least 5 players per team (got ${teamCounts.team_a}/${teamCounts.team_b}).`);
  }
  if (parsed.match.rounds.length < 1) {
    throw new Error("match.rounds must include at least one completed round.");
  }

  const roundNumbers = new Set();
  parsed.match.rounds.forEach((round, index) => {
    const prefix = `match.rounds[${index}]`;
    assertNumber(round.number, `${prefix}.number`);
    assertString(round.winnerTeamId, `${prefix}.winnerTeamId`);
    assertObject(round.sideByTeam, `${prefix}.sideByTeam`);
    assertArray(round.events, `${prefix}.events`);
    if (!Number.isInteger(round.number) || round.number < 1 || roundNumbers.has(round.number)) {
      throw new Error(`${prefix}.number must be a unique positive integer.`);
    }
    if (!validTeams.has(round.winnerTeamId)) {
      throw new Error(`${prefix}.winnerTeamId must be team_a or team_b.`);
    }
    if (!["T", "CT"].includes(round.sideByTeam.team_a) || !["T", "CT"].includes(round.sideByTeam.team_b) || round.sideByTeam.team_a === round.sideByTeam.team_b) {
      throw new Error(`${prefix}.sideByTeam must map teams to opposite T/CT sides.`);
    }
    roundNumbers.add(round.number);
  });

  const scoreA = parsed.match.rounds.filter((round) => round.winnerTeamId === "team_a").length;
  const scoreB = parsed.match.rounds.filter((round) => round.winnerTeamId === "team_b").length;
  if (parsed.match.score.team_a !== scoreA || parsed.match.score.team_b !== scoreB) {
    throw new Error(`match.score must equal completed round winners (expected ${scoreA}-${scoreB}).`);
  }
  if (parsed.match.roundsPlayed !== undefined && parsed.match.roundsPlayed !== parsed.match.rounds.length) {
    throw new Error("match.roundsPlayed must equal match.rounds.length.");
  }

  const evidenceIds = new Set();
  parsed.match.evidence.forEach((evidence, index) => {
    const prefix = `match.evidence[${index}]`;
    assertString(evidence.id, `${prefix}.id`);
    assertString(evidence.playerId, `${prefix}.playerId`);
    assertNumber(evidence.round, `${prefix}.round`);
    assertString(evidence.time, `${prefix}.time`);
    assertString(evidence.location, `${prefix}.location`);
    assertString(evidence.description, `${prefix}.description`);
    if (evidenceIds.has(evidence.id)) throw new Error(`${prefix}.id must be unique.`);
    if (!playerIds.has(evidence.playerId)) throw new Error(`${prefix}.playerId must reference a parsed player.`);
    if (!roundNumbers.has(evidence.round)) throw new Error(`${prefix}.round must reference a completed round.`);
    if (!/^\d+:\d{2}$/.test(evidence.time)) throw new Error(`${prefix}.time must use m:ss format.`);
    evidenceIds.add(evidence.id);
  });
}

function assertObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
}

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
}

function assertString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }
}

function assertNumber(value, name) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${name} must be a number.`);
  }
}
