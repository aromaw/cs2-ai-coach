import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getMatchAnalysis, listMatches } from "./queries/matches";

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
});

export type AppRouter = typeof appRouter;
