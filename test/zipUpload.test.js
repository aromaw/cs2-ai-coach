import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { extractDemFromZip, DEMO_MAGIC, ZipDemError } from "../src/zipDem.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

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
    local.writeUInt16LE(0, 28);
    locals.push(Buffer.concat([local, nameBuf, payload]));

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(entry.method, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
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

function fakeDem(payload = "demo-bytes") {
  return Buffer.concat([DEMO_MAGIC, Buffer.from(payload)]);
}

function withTempZip(buffer, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zipdem-test-"));
  const zipPath = path.join(dir, "upload.zip");
  fs.writeFileSync(zipPath, buffer);
  try {
    return fn(zipPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("extractDemFromZip extracts a stored .dem entry", () => {
  const zip = buildZip([{ name: "WMPVP_123_0.dem", data: fakeDem(), method: 0 }]);
  withTempZip(zip, (zipPath) => {
    const { buffer, entryName } = extractDemFromZip(zipPath);
    assert.equal(entryName, "WMPVP_123_0.dem");
    assert.ok(buffer.subarray(0, DEMO_MAGIC.length).equals(DEMO_MAGIC));
  });
});

test("extractDemFromZip extracts a deflated .dem entry", () => {
  const big = fakeDem("x".repeat(64 * 1024));
  const zip = buildZip([{ name: "9211728447651027212_0.dem", data: big, method: 8 }]);
  withTempZip(zip, (zipPath) => {
    const { buffer, entryName } = extractDemFromZip(zipPath);
    assert.equal(entryName, "9211728447651027212_0.dem");
    assert.equal(buffer.length, big.length);
    assert.equal(buffer.toString("latin1", 8, 8 + 9), "xxxxxxxxx");
  });
});

test("extractDemFromZip accepts a single non-dem entry with a valid magic", () => {
  const zip = buildZip([{ name: "replay", data: fakeDem(), method: 0 }]);
  withTempZip(zip, (zipPath) => {
    const { entryName } = extractDemFromZip(zipPath);
    assert.equal(entryName, "replay");
  });
});

test("extractDemFromZip prefers the .dem entry among multiple files", () => {
  const zip = buildZip([
    { name: "readme.txt", data: Buffer.from("not a demo"), method: 0 },
    { name: "match.dem", data: fakeDem(), method: 0 },
  ]);
  withTempZip(zip, (zipPath) => {
    const { entryName } = extractDemFromZip(zipPath);
    assert.equal(entryName, "match.dem");
  });
});

test("extractDemFromZip rejects archives without any demo candidate", () => {
  const zip = buildZip([
    { name: "a.txt", data: Buffer.from("a"), method: 0 },
    { name: "b.txt", data: Buffer.from("b"), method: 0 },
  ]);
  withTempZip(zip, (zipPath) => {
    assert.throws(() => extractDemFromZip(zipPath), (error) => {
      assert.ok(error instanceof ZipDemError);
      assert.equal(error.status, 400);
      return true;
    });
  });
});

test("extractDemFromZip rejects entries without the PBDEMS2 magic", () => {
  const zip = buildZip([{ name: "match.dem", data: Buffer.from("PBDEMS1\0nope"), method: 0 }]);
  withTempZip(zip, (zipPath) => {
    assert.throws(() => extractDemFromZip(zipPath), /不是有效 CS2 demo/);
  });
});

test("extractDemFromZip rejects non-zip input", () => {
  withTempZip(Buffer.from("this is not a zip at all"), (zipPath) => {
    assert.throws(() => extractDemFromZip(zipPath), ZipDemError);
  });
});

test("extractDemFromZip rejects archives that claim an oversized demo", () => {
  const zip = buildZip([{ name: "match.dem", data: fakeDem(), method: 0 }]);
  const cdStart = zip.length - 22 - (46 + "match.dem".length);
  zip.writeUInt32LE(0xfffffff0, cdStart + 24);
  withTempZip(zip, (zipPath) => {
    assert.throws(() => extractDemFromZip(zipPath), (error) => {
      assert.equal(error.status, 413);
      return true;
    });
  });
});

