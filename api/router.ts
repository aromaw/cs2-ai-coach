import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getMatchAnalysis, listMatches } from "./queries/matches";
import { buildPlayerTrend, listRoster } from "./lib/trends";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  matches: createRouter({
    /** 历史对局列表 */
    list: publicQuery.query(() => listMatches()),

    /** 单场完整分析结果 */
    byId: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const analysis = await getMatchAnalysis(input.id);
        if (!analysis) throw new Error("MATCH_NOT_FOUND");
        return analysis;
      }),
  }),

  /** 近期趋势：最近 5 场的风格变化与瓶颈 */
  trends: createRouter({
    /** 存档比赛中出现过的玩家（趋势页选择器） */
    roster: publicQuery.query(() => listRoster()),

    /** 某玩家的近期趋势报告 */
    player: publicQuery
      .input(
        z.object({
          steamid: z.string().min(1),
          limit: z.number().int().min(2).max(10).optional(),
        }),
      )
      .query(async ({ input }) => {
        const trend = await buildPlayerTrend(input.steamid, input.limit ?? 5);
        if (!trend) throw new Error("TREND_NOT_FOUND");
        return trend;
      }),
  }),
});

export type AppRouter = typeof appRouter;
