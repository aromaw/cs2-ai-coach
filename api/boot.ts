import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

// demo 文件可达 300MB+，放大请求体限制
app.use(bodyLimit({ maxSize: 512 * 1024 * 1024 }));

// CS2 demo 上传与解析：multipart/form-data，字段名 "file"
app.post("/api/demo/upload", async (c) => {
  const { writeFile, mkdir } = await import("fs/promises");
  const os = await import("os");
  const path = await import("path");

  let tmpPath: string | null = null;
  try {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) {
      return c.json({ error: "缺少 demo 文件（字段名 file）" }, 400);
    }
    if (!file.name.toLowerCase().endsWith(".dem")) {
      return c.json({ error: "仅支持 .dem 格式的 CS2 录像文件" }, 400);
    }

    const dir = path.join(os.tmpdir(), "retake-uploads");
    await mkdir(dir, { recursive: true });
    tmpPath = path.join(dir, `${Date.now()}-${file.name}`);
    await writeFile(tmpPath, Buffer.from(await file.arrayBuffer()));

    const { parseDemoFile } = await import("./lib/demoParser");
    const { analyzeDemo } = await import("./lib/analytics");
    const { insertMatch } = await import("./queries/matches");

    const raw = parseDemoFile(tmpPath);
    const analysis = analyzeDemo(raw, file.name);
    if (!analysis.players.length || !analysis.rounds.length) {
      return c.json(
        { error: "解析结果为空：该文件可能不是有效的 CS2 比赛录像" },
        422,
      );
    }
    const id = await insertMatch(analysis);
    return c.json({
      id,
      map: analysis.match.displayMap,
      score: `${analysis.match.scoreT}:${analysis.match.scoreCT}`,
      rounds: analysis.match.roundsTotal,
      players: analysis.players.length,
    });
  } catch (e) {
    console.error("[demo upload]", e);
    return c.json(
      { error: `demo 解析失败：${(e as Error).message}` },
      500,
    );
  } finally {
    if (tmpPath) {
      const { unlink } = await import("fs/promises");
      unlink(tmpPath).catch(() => {});
    }
  }
});

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
