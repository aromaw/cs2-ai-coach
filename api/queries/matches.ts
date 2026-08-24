// 比赛记录的存取
import { desc, eq } from "drizzle-orm";
import { getDb } from "./connection";
import { matches } from "@db/schema";
import type { AnalysisResult, MatchSummary } from "../../contracts/analysis";

export async function insertMatch(analysis: AnalysisResult): Promise<number> {
  const db = getDb();
  const m = analysis.match;
  const [res] = await db.insert(matches).values({
    fileName: m.fileName,
    mapName: m.mapName,
    displayMap: m.displayMap,
    teamTName: m.teamTName,
    teamCTName: m.teamCTName,
    scoreT: m.scoreT,
    scoreCT: m.scoreCT,
    roundsTotal: m.roundsTotal,
    durationSec: m.durationSec,
    source: m.source,
    analysis,
  });
  return Number(res.insertId);
}

export async function listMatches(): Promise<MatchSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: matches.id,
      mapName: matches.mapName,
      displayMap: matches.displayMap,
      teamTName: matches.teamTName,
      teamCTName: matches.teamCTName,
      scoreT: matches.scoreT,
      scoreCT: matches.scoreCT,
      roundsTotal: matches.roundsTotal,
      source: matches.source,
      createdAt: matches.createdAt,
    })
    .from(matches)
    .orderBy(desc(matches.createdAt))
    .limit(100);
  return rows.map((r) => ({
    id: Number(r.id),
    mapName: r.mapName,
    displayMap: r.displayMap,
    teamTName: r.teamTName,
    teamCTName: r.teamCTName,
    scoreT: r.scoreT,
    scoreCT: r.scoreCT,
    roundsTotal: r.roundsTotal,
    source: r.source,
    playedAt: r.createdAt.toISOString(),
  }));
}

export async function getMatchAnalysis(
  id: number,
): Promise<AnalysisResult | null> {
  const db = getDb();
  const [row] = await db
    .select({ analysis: matches.analysis })
    .from(matches)
    .where(eq(matches.id, id))
    .limit(1);
  if (!row) return null;
  const analysis = row.analysis as AnalysisResult;
  analysis.match.id = Number(id);
  return analysis;
}
