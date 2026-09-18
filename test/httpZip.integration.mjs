// zip 上传 HTTP 集成验证：独立脚本运行（非 node:test），
// 因为它需要启动真实服务器子进程。用法：node test/httpZip.integration.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { DEMO_MAGIC } from "../src/zipDem.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = 35000 + Math.floor(Math.random() * 20000);

function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const payload = entry.method === 8 ? zlib.deflateRawSync(entry.data) : entry.data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(entry.method, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(Buffer.concat([local, nameBuf, payload]));
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(entry.method, 10);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));
    offset += 30 + nameBuf.length + payload.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

function request(method, pathName, headers, body) {
  return new Promise((resolve, reject) => {
    const finalHeaders = { ...(headers || {}) };
    if (body && !finalHeaders["content-length"]) finalHeaders["content-length"] = body.length;
    const req = http.request(
      { host: "127.0.0.1", port, path: pathName, method, headers: finalHeaders },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            // raw text
          }
          resolve({ status: res.statusCode, json, text });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function cleanupData() {
  for (const dir of ["data/uploads", "data/reports"]) {
    try {
      for (const file of await fsp.readdir(path.join(root, dir))) {
        if (file !== ".gitkeep") await fsp.rm(path.join(root, dir, file), { force: true });
      }
    } catch {
      // ignore
    }
  }
}

async function main() {
  const child = spawn(process.execPath, [path.join(root, "src", "server.js")], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      CS2_DEMO_PARSER_BIN: path.join(root, "tools", "mock-real-parser.sh"),
      CS2_DEMO_PARSER_REQUIRED: "true",
    },
    stdio: ["ignore","inherit","inherit"],
  });
  const guard = setTimeout(() => {
    console.error("integration test timed out");
    child.kill("SIGKILL");
    process.exit(1);
  }, 30000);
  guard.unref();

  try {
    let healthy = false;
    for (let i = 0; i < 60 && !healthy; i += 1) {
      try {
        const res = await request("GET", "/health");
        healthy = res.status === 200;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    assert.ok(healthy, "server did not become healthy");

    const zip = buildZip([
      { name: "WMPVP_9207926766762418572_0.dem", data: Buffer.concat([DEMO_MAGIC, Buffer.from("wanmei-payload")]), method: 8 },
    ]);
    const upload = await request("POST", "/api/uploads?filename=WMPVP_9207926766762418572_0.zip", {
      "content-type": "application/zip",
      "x-file-name": "WMPVP_9207926766762418572_0.zip",
    }, zip);
    assert.equal(upload.status, 201, upload.text);
    assert.equal(upload.json.parser.mode, "real-demo-parser");
    assert.equal(upload.json.parser.fallback, false);
    assert.equal(upload.json.upload.originalName, "WMPVP_9207926766762418572_0.dem");
    assert.equal(upload.json.upload.archiveName, "WMPVP_9207926766762418572_0.zip");

    const report = await request("POST", "/api/reports", { "content-type": "application/json" },
      Buffer.from(JSON.stringify({
        uploadId: upload.json.upload.id,
        teamPlayerIds: ["p1", "p2", "p3", "p4", "p5"],
        focusPlayerId: "p1",
        targetRole: "Auto",
      })));
    assert.equal(report.status, 201, report.text);

    const badZip = buildZip([
      { name: "note.txt", data: Buffer.from("no demo"), method: 0 },
      { name: "info.json", data: Buffer.from("{}"), method: 0 },
    ]);
    const bad = await request("POST", "/api/uploads?filename=empty.zip", {
      "content-type": "application/zip",
      "x-file-name": "empty.zip",
    }, badZip);
    assert.equal(bad.status, 400);
    assert.match(bad.json.error, /没有 \.dem/);

    console.log("zip HTTP integration: OK");
  } finally {
    clearTimeout(guard);
    child.kill("SIGTERM");
    await cleanupData();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
