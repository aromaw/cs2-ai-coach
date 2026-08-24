// 统一的比赛数据获取层：
// - id 为 "demo"（或非数字）→ 返回内置示例对局
// - id 为数字 → 通过 tRPC 拉取真实解析结果；失败时回退示例数据并标记 fallback
import { trpc } from "@/providers/trpc";
import { MOCK_MATCH } from "./mock-match";
import type { AnalysisResult, MatchSummary } from "@contracts/analysis";

export interface MatchDataState {
  data: AnalysisResult | undefined;
  isLoading: boolean;
  /** 真实数据加载失败但已回退到示例数据时为 true */
  isFallback: boolean;
  source: "demo" | "upload";
}

export function useMatchData(id?: string): MatchDataState {
  const numericId = id && /^\d+$/.test(id) ? Number(id) : null;
  const query = trpc.matches.byId.useQuery(
    { id: numericId ?? 0 },
    { enabled: numericId !== null, retry: 1 },
  );

  if (numericId === null) {
    return { data: MOCK_MATCH, isLoading: false, isFallback: false, source: "demo" };
  }
  if (query.isLoading) {
    return { data: undefined, isLoading: true, isFallback: false, source: "upload" };
  }
  if (query.isError || !query.data) {
    return { data: MOCK_MATCH, isLoading: false, isFallback: true, source: "demo" };
  }
  return { data: query.data, isLoading: false, isFallback: false, source: "upload" };
}

export interface HistoryState {
  items: MatchSummary[];
  isLoading: boolean;
  isFallback: boolean;
}

/** 历史对局列表：真实记录 + 置顶的内置示例 */
export function useMatchHistory(): HistoryState {
  const query = trpc.matches.list.useQuery(undefined, { retry: 1 });
  const demoItem: MatchSummary = {
    id: -1, // 前端路由用 /match/demo
    mapName: "de_mirage",
    displayMap: "Mirage",
    teamTName: "NOVA",
    teamCTName: "AETHER",
    scoreT: 13,
    scoreCT: 9,
    roundsTotal: 24,
    source: "demo",
    playedAt: "2026-08-22T14:30:00.000Z",
  };
  if (query.isLoading) return { items: [], isLoading: true, isFallback: false };
  if (query.isError || !query.data)
    return { items: [demoItem], isLoading: false, isFallback: true };
  return { items: [demoItem, ...query.data], isLoading: false, isFallback: false };
}

/** 上传 demo 文件，返回新比赛 id；失败抛出错误信息 */
export async function uploadDemo(file: File): Promise<number> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/demo/upload", { method: "POST", body: form });
  const json = (await res.json()) as { id?: number; error?: string };
  if (!res.ok || !json.id) {
    throw new Error(json.error ?? `上传失败（HTTP ${res.status}）`);
  }
  return json.id;
}
