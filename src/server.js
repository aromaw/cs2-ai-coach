import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { enrichReportWithAI } from "./aiRunner.js";
import { buildReport } from "./analyzer.js";
import { reportToMarkdown } from "./markdown.js";
import { parseDemo } from "./parser.js";
import { parseUploadedDemo } from "./parserRunner.js";
import { createId, sanitizeFileName } from "./util.js";
import { extractDemFromZip, ZipDemError } from "./zipDem.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const REPORT_DIR = path.join(DATA_DIR, "reports");
const FEEDBACK_DIR = path.join(DATA_DIR, "feedback");
const FEEDBACK_FILE = path.join(FEEDBACK_DIR, "feedback.jsonl");
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const DEFAULT_PORT = 4173;
const PORT = parsePort(process.env.PORT || DEFAULT_PORT);
const HOST = process.env.HOST || "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8"
};

await ensureDirectories();

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  let statusCode = 200;

  const originalWriteHead = res.writeHead;
  res.writeHead = function(code, ...args) {
    statusCode = code;
    return originalWriteHead.apply(this, [code, ...args]);
  };

  res.on("finish", () => {
    const elapsed = Date.now() - startTime;
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (!url.pathname.match(/\.(css|js|svg|png|ico)$/)) {
      console.log(`${req.method} ${url.pathname} ${statusCode} ${elapsed}ms`);
    }
  });

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { ok: true, service: "cs2-demo-ai-coach" });
    }

    if (req.method === "POST" && url.pathname === "/api/uploads") {
      return await handleUpload(req, res, url);
    }

    if (req.method === "POST" && url.pathname === "/api/sample") {
      return await handleSample(res);
    }

    if (req.method === "GET" && url.pathname === "/api/reports") {
      return await handleListReports(res);
    }

    if (req.method === "POST" && url.pathname === "/api/reports") {
      return await handleCreateReport(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/feedback") {
      return await handleFeedback(req, res);
    }

    const reportExportMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\/export$/);
    if (req.method === "GET" && reportExportMatch) {
      return await handleExportReport(res, reportExportMatch[1]);
    }

    const reportMatch = url.pathname.match(/^\/api\/reports\/([^/]+)$/);
    if (req.method === "GET" && reportMatch) {
      return await handleGetReport(res, reportMatch[1]);
    }

    if (req.method === "GET" || req.method === "HEAD") {
      return await serveStatic(req, res, url.pathname);
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    if (error instanceof HttpError) {
      return sendJson(res, error.status, { error: error.message });
    }
    return sendJson(res, 500, { error: error.message || "Internal server error" });
  }
});

listenWithFallback(server, PORT, HOST);

async function ensureDirectories() {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  await fsp.mkdir(REPORT_DIR, { recursive: true });
  await fsp.mkdir(FEEDBACK_DIR, { recursive: true });
}

async function handleUpload(req, res, url) {
  const uploadStart = Date.now();
  const originalName = sanitizeFileName(req.headers["x-file-name"] || url.searchParams.get("filename") || "upload.dem");
  const isZip = originalName.toLowerCase().endsWith(".zip");
  const isDem = originalName.toLowerCase().endsWith(".dem");
  if (!isDem && !isZip) {
    drain(req);
    return sendJson(res, 400, { error: "仅支持 .dem 或 .zip 文件（完美平台下载的 zip 可直接上传）" });
  }

  const uploadId = createId("upload");
  const targetPath = path.join(UPLOAD_DIR, `${uploadId}.dem`);
  const tempPath = `${targetPath}.part`;
  const hash = crypto.createHash("sha256");
  let size = 0;
  let tooLarge = false;

  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);

  const out = fs.createWriteStream(tempPath, { flags: "wx", highWaterMark: 256 * 1024 });

  console.log(`[${uploadId}] Upload started: ${originalName}`);

  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      size += chunk.length;
      hash.update(chunk);
      if (size > MAX_UPLOAD_BYTES) {
        tooLarge = true;
        out.destroy();
        req.destroy(new Error("文件超过 500 MB 上传限制"));
        reject(new Error("文件超过 500 MB 上传限制"));
      } else {
        if (!out.write(chunk)) {
          req.pause();
          out.once("drain", () => req.resume());
        }
      }
    });
    req.on("end", () => {
      const uploadElapsed = Date.now() - uploadStart;
      console.log(`[${uploadId}] Upload completed: ${(size / 1024 / 1024).toFixed(2)}MB in ${uploadElapsed}ms`);
      out.end();
    });
    req.on("error", (error) => {
      console.log(`[${uploadId}] Upload error: ${error.message}`);
      out.destroy();
      reject(error);
    });
    out.on("error", reject);
    out.on("finish", resolve);
  }).catch(async (error) => {
    await fsp.rm(tempPath, { force: true });
    if (tooLarge) {
      sendJson(res, 413, { error: error.message });
      return null;
    }
    throw error;
  });

  if (tooLarge || res.writableEnded) return;

  await fsp.rename(tempPath, targetPath);
  let storedPath = targetPath;
  let displayName = originalName;
  let archiveName;
  let finalSize = size;
  let finalHash = hash.digest("hex");
  if (isZip) {
    let extracted;
    try {
        extracted = extractDemFromZip(targetPath);
    } catch (error) {
      await fsp.rm(targetPath, { force: true });
      if (error instanceof ZipDemError) {
        throw new HttpError(error.status, error.message);
      }
      throw error;
    }
    const demPath = path.join(UPLOAD_DIR, `${uploadId}.dem`);
    try {
      await fsp.writeFile(demPath, extracted.buffer);
    } catch (error) {
      await fsp.rm(targetPath, { force: true });
      throw error;
    }
    storedPath = demPath;
    displayName = sanitizeFileName(extracted.entryName || `${uploadId}.dem`);
    if (!displayName.toLowerCase().endsWith(".dem")) displayName = `${displayName}.dem`;
    archiveName = originalName;
    finalSize = extracted.buffer.length;
    finalHash = crypto.createHash("sha256").update(extracted.buffer).digest("hex");
  }
  const uploadRecord = {
    id: uploadId,
    originalName: displayName,
    archiveName,
    size: finalSize,
    sha256: finalHash,
    storedPath,
    createdAt: new Date().toISOString()
  };

  console.log(`[${uploadId}] Parsing started`);
  const parseStart = Date.now();

  let parsed;
  try {
    parsed = await parseUploadedDemo(uploadRecord);
    const parseElapsed = Date.now() - parseStart;
    console.log(`[${uploadId}] Parsing completed in ${parseElapsed}ms (mode: ${parsed.parser.mode})`);
  } catch (error) {
    console.log(`[${uploadId}] Parsing failed: ${error.message}`);
    await writeJson(path.join(UPLOAD_DIR, `${uploadId}.json`), {
      ...uploadRecord,
      parseError: error.message,
      failedAt: new Date().toISOString()
    });
    await fsp.rm(storedPath, { force: true });
    if (isZip) await fsp.rm(targetPath, { force: true });
    throw new HttpError(422, `Demo parsing failed: ${error.message}`);
  }
  const stored = { ...uploadRecord, parsed };
  await writeJson(path.join(UPLOAD_DIR, `${uploadId}.json`), stored);

  if (isZip) {
    await fsp.rm(targetPath, { force: true }).catch(() => {});
  }
  return sendJson(res, 201, {
    upload: {
      id: uploadId,
      originalName: displayName,
      archiveName,
      size: finalSize,
      sha256: finalHash,
      createdAt: uploadRecord.createdAt
    },
    parser: parsed.parser,
    match: parsed.match
  });
}

async function handleSample(res) {
  const uploadId = createId("upload");
  const sha256 = crypto.createHash("sha256").update(`${uploadId}:${Date.now()}`).digest("hex");
  const uploadRecord = {
    id: uploadId,
    originalName: "sample-mirage.dem",
    size: 0,
    sha256,
    storedPath: "",
    createdAt: new Date().toISOString(),
    sample: true
  };
  const parsed = parseDemo(uploadRecord);
  parsed.parser = {
    ...parsed.parser,
    mode: "synthetic-sample",
    fallback: false,
    sample: true
  };
  const stored = { ...uploadRecord, parsed };
  await writeJson(path.join(UPLOAD_DIR, `${uploadId}.json`), stored);
  return sendJson(res, 201, {
    upload: {
      id: uploadId,
      originalName: uploadRecord.originalName,
      size: 0,
      sha256,
      createdAt: uploadRecord.createdAt,
      sample: true
    },
    parser: parsed.parser,
    match: parsed.match
  });
}

async function handleCreateReport(req, res) {
  const body = await readJsonBody(req);
  const uploadId = String(body.uploadId || "");
  const uploadRecord = await readUpload(uploadId);
  if (!uploadRecord.parsed || uploadRecord.parseError) {
    throw new HttpError(422, "该上传记录没有可用的解析结果。");
  }
  const baseReport = buildReport(uploadRecord.parsed, {
    teamPlayerIds: body.teamPlayerIds,
    focusPlayerId: body.focusPlayerId,
    targetRole: body.targetRole
  });
  const report = await enrichReportWithAI(baseReport);
  await writeJson(path.join(REPORT_DIR, `${report.id}.json`), report);
  return sendJson(res, 201, report);
}

async function handleListReports(res) {
  const files = (await fsp.readdir(REPORT_DIR)).filter((file) => file.endsWith(".json"));
  const reports = [];
  for (const file of files) {
    try {
      const report = await readJson(path.join(REPORT_DIR, file));
      reports.push({
        id: report.id,
        createdAt: report.createdAt,
        map: report.match.map,
        score: report.overview.score,
        focusPlayer: report.focusPlayer.name,
        selectedTeam: report.selectedTeam.map((player) => player.name)
      });
    } catch {
      // Ignore partially written or manually edited files in the history list.
    }
  }
  reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sendJson(res, 200, { reports });
}

async function handleGetReport(res, id) {
  const report = await readReport(id);
  return sendJson(res, 200, report);
}

async function handleExportReport(res, id) {
  const report = await readReport(id);
  const markdown = reportToMarkdown(report);
  res.writeHead(200, {
    "content-type": "text/markdown; charset=utf-8",
    "content-disposition": `attachment; filename="${id}.md"`
  });
  res.end(markdown);
}

async function handleFeedback(req, res) {
  const body = await readJsonBody(req);
  const rating = String(body.rating || "");
  if (!["useful", "inaccurate"].includes(rating)) {
    throw new HttpError(400, "Feedback rating must be useful or inaccurate.");
  }
  const entry = {
    id: createId("feedback"),
    reportId: String(body.reportId || ""),
    targetType: String(body.targetType || "suggestion"),
    targetId: String(body.targetId || ""),
    rating,
    createdAt: new Date().toISOString()
  };
  await fsp.appendFile(FEEDBACK_FILE, `${JSON.stringify(entry)}\n`);
  return sendJson(res, 201, { ok: true, feedback: entry });
}

async function readUpload(id) {
  if (!/^upload_[a-f0-9]+$/.test(id)) {
    throw new HttpError(400, "Invalid upload id.");
  }
  const filePath = path.join(UPLOAD_DIR, `${id}.json`);
  return readJson(filePath).catch(() => {
    throw new HttpError(404, "Upload not found.");
  });
}

async function readReport(id) {
  if (!/^report_[a-f0-9]+$/.test(id)) {
    throw new HttpError(400, "Invalid report id.");
  }
  const filePath = path.join(REPORT_DIR, `${id}.json`);
  return readJson(filePath).catch(() => {
    throw new HttpError(404, "Report not found.");
  });
}

async function serveStatic(req, res, requestPath) {
  const normalized = requestPath === "/" ? "/index.html" : requestPath;
  const decoded = decodeURIComponent(normalized);
  const filePath = path.normalize(path.join(PUBLIC_DIR, decoded));
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return sendJson(res, 404, { error: "Not found" });
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME_TYPES[ext] || "application/octet-stream",
      "content-length": stat.size
    });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(filePath).pipe(res);
  } catch {
    return sendJson(res, 404, { error: "Not found" });
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        req.destroy();
        reject(new HttpError(413, "JSON body is too large."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

async function readJson(filePath) {
  return JSON.parse(await fsp.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sendJson(res, status, payload) {
  if (res.writableEnded) return;
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(payload)}\n`);
}

function drain(req) {
  req.resume();
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return port;
}

function listenWithFallback(httpServer, startPort, host) {
  const maxAttempts = 20;
  let attempts = 0;

  const tryListen = (port) => {
    httpServer.once("error", (error) => {
      if (error.code === "EADDRINUSE" && attempts < maxAttempts) {
        attempts += 1;
        tryListen(port + 1);
        return;
      }
      throw error;
    });
    httpServer.listen(port, host, () => {
      console.log(`CS2 Demo AI Coach running at http://${host}:${port}`);
    });
  };

  tryListen(startPort);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

process.on("uncaughtException", (error) => {
  if (error instanceof HttpError) return;
  console.error(error);
});
