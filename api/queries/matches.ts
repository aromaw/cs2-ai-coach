// 比赛记录的存取（本地 JSON 文件存储，替代原 MySQL/drizzle 实现，
// 使 RETAKE 生产链路无需数据库即可运行）。
import fsp from "fs/promises";
import path from "path";
import type { AnalysisResult, MatchSummary } from "../../contracts/analysis";

const DATA_DIR = path.resolve(process.cwd(), "data", "retake-matches");

async function ensureDir(): Promise<void> {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function nextId(): Promise<number> {
  const files = await fsp.readdir(DATA_DIR).catch(() => [] as string[]);
  let max = 0;
  for (const file of files) {
    const match = file.match(/^(\d+)\.json$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

export async function insertMatch(analysis: AnalysisResult): Promise<number> {
  await ensureDir();
  const id = await nextId();
  const stored: AnalysisResult = {
    ...analysis,
    match: { ...analysis.match, id },
  };
  const tmp = path.join(DATA_DIR, `.${id}.json.tmp`);
  await fsp.writeFile(tmp, JSON.stringify(stored));
  await fsp.rename(tmp, path.join(DATA_DIR, `${id}.json`));
  return id;
}

export async function listMatches(): Promise<MatchSummary[]> {
  await ensureDir();
  const files = (await fsp.readdir(DATA_DIR)).filter((f) => /^\d+\.json$/.test(f));
  const out: MatchSummary[] = [];
  for (const file of files) {
    try {
      const analysis = JSON.parse(
        await fsp.readFile(path.join(DATA_DIR, file), "utf8"),
      ) as AnalysisResult;
      const m = analysis.match;
      out.push({
        id: Number(file.match(/\d+/)![0]),
        mapName: m.mapName,
        displayMap: m.displayMap,
        teamTName: m.teamTName,
        teamCTName: m.teamCTName,
        scoreT: m.scoreT,
        scoreCT: m.scoreCT,
        roundsTotal: m.roundsTotal,
        source: m.source,
        playedAt: m.playedAt,
      });
    } catch {
      // 跳过损坏的存档文件
    }
  }
  out.sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  return out.slice(0, 100);
}

export async function getMatchAnalysis(
  id: number,
): Promise<AnalysisResult | null> {
  try {
    const analysis = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, `${id}.json`), "utf8"),
    ) as AnalysisResult;
    analysis.match.id = id;
    return analysis;
  } catch {
    return null;
  }
}
