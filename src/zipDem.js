// 完美平台等平台把下载的 demo 包成标准 zip（内含同名 .dem）。
// 这里用零依赖方式解出 .dem：解析 EOCD + 中央目录 + 本地头，
// 校验 PBDEMS2 魔数并限制解压后大小，防止 zip bomb。
import fs from "node:fs";
import zlib from "node:zlib";

export const DEMO_MAGIC = Buffer.from("PBDEMS2\0", "latin1");
export const MAX_EXTRACTED_DEMO_BYTES = 1024 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 64;
const EOCD_SIGNATURE = 0x06054b50;
const CD_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const ZIP64_SENTINEL = 0xffffffff;

export class ZipDemError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function findEocd(zip) {
  const min = Math.max(0, zip.length - 22 - 65535);
  for (let i = zip.length - 22; i >= min; i -= 1) {
    if (zip.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

function readCentralDirectory(zip, eocdOffset) {
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  const cdOffset = zip.readUInt32LE(eocdOffset + 16);
  if (entryCount === 0 || entryCount > MAX_ZIP_ENTRIES) {
    throw new ZipDemError(400, `zip 条目数异常（${entryCount}），已拒绝`);
  }
  if (cdOffset + 46 > zip.length) {
    throw new ZipDemError(400, "zip 中央目录损坏");
  }
  const entries = [];
  let offset = cdOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > zip.length || zip.readUInt32LE(offset) !== CD_SIGNATURE) {
      throw new ZipDemError(400, "zip 中央目录条目损坏");
    }
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const nameLen = zip.readUInt16LE(offset + 28);
    const extraLen = zip.readUInt16LE(offset + 30);
    const commentLen = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLen);
    entries.push({ method, compressedSize, uncompressedSize, localOffset, name });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function pickDemoEntry(entries) {
  const files = entries.filter((entry) => !entry.name.endsWith("/"));
  if (!files.length) {
    throw new ZipDemError(400, "zip 中没有文件");
  }
  const named = files.find((entry) => entry.name.toLowerCase().endsWith(".dem"));
  if (named) return named;
  if (files.length === 1) return files[0];
  throw new ZipDemError(400, "zip 中没有 .dem 文件，请先解压或检查下载内容");
}

function inflateEntry(zip, entry) {
  if (
    entry.uncompressedSize === ZIP64_SENTINEL ||
    entry.compressedSize === ZIP64_SENTINEL ||
    entry.localOffset === ZIP64_SENTINEL
  ) {
    throw new ZipDemError(413, "zip 使用了 ZIP64 扩展，demo 超出支持范围");
  }
  if (entry.uncompressedSize > MAX_EXTRACTED_DEMO_BYTES) {
    throw new ZipDemError(413, "解压后的 demo 超过 1 GB 大小限制");
  }
  const local = entry.localOffset;
  if (local + 30 > zip.length || zip.readUInt32LE(local) !== LOCAL_SIGNATURE) {
    throw new ZipDemError(400, "zip 本地文件头损坏");
  }
  const nameLen = zip.readUInt16LE(local + 26);
  const extraLen = zip.readUInt16LE(local + 28);
  const dataStart = local + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > zip.length) {
    throw new ZipDemError(400, "zip 数据不完整，文件可能下载损坏");
  }
  const compressed = zip.subarray(dataStart, dataEnd);
  let dem;
  if (entry.method === 0) {
    dem = Buffer.from(compressed);
  } else if (entry.method === 8) {
    try {
      dem = zlib.inflateRawSync(compressed, {
        maxOutputLength: MAX_EXTRACTED_DEMO_BYTES + 1,
      });
    } catch {
      throw new ZipDemError(400, "zip 解压失败，文件可能损坏");
    }
  } else {
    throw new ZipDemError(400, `zip 使用了不支持的压缩方式（method=${entry.method}）`);
  }
  if (dem.length > MAX_EXTRACTED_DEMO_BYTES) {
    throw new ZipDemError(413, "解压后的 demo 超过 1 GB 大小限制");
  }
  return dem;
}

/** 从 zip 中提取 CS2 demo，返回 { buffer, entryName }。失败抛 ZipDemError。 */
export function extractDemFromZip(zipPath) {
  let zip;
  try {
    zip = fs.readFileSync(zipPath);
  } catch {
    throw new ZipDemError(400, "无法读取上传的 zip 文件");
  }
  if (zip.length < 22) {
    throw new ZipDemError(400, "不是有效的 zip 文件");
  }
  const eocdOffset = findEocd(zip);
  if (eocdOffset < 0) {
    throw new ZipDemError(400, "不是有效的 zip 文件（找不到目录结尾记录）");
  }
  const entries = readCentralDirectory(zip, eocdOffset);
  const entry = pickDemoEntry(entries);
  const dem = inflateEntry(zip, entry);
  if (dem.length < DEMO_MAGIC.length || !dem.subarray(0, DEMO_MAGIC.length).equals(DEMO_MAGIC)) {
    throw new ZipDemError(
      400,
      `zip 中的 ${entry.name} 不是有效 CS2 demo（缺少 PBDEMS2 文件头）`,
    );
  }
  return { buffer: dem, entryName: entry.name.split("/").pop() || entry.name };
}
