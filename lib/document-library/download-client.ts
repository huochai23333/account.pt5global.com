import type { ExplorerTarget } from "./model";

const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_DIRECTORY_END = 0x06054b50;
const ZIP_DIRECTORY_END_BYTES = 22;

async function verifyZipFraming(content: Blob) {
  if (content.type !== "application/zip" || content.size < 4 + ZIP_DIRECTORY_END_BYTES) {
    throw new Error("unconfirmed");
  }

  // 本接口生成单卷、无注释的 ZIP。只读取首尾固定长度，避免再次复制整个压缩包。
  const endOffset = content.size - ZIP_DIRECTORY_END_BYTES;
  const [startBytes, endBytes] = await Promise.all([
    content.slice(0, 4).arrayBuffer(),
    content.slice(endOffset).arrayBuffer(),
  ]);
  const start = new DataView(startBytes);
  const end = new DataView(endBytes);
  const entryCount = end.getUint16(10, true);
  const directoryLength = end.getUint32(12, true);
  const directoryOffset = end.getUint32(16, true);
  if (
    start.getUint32(0, true) !== ZIP_LOCAL_HEADER ||
    end.getUint32(0, true) !== ZIP_DIRECTORY_END ||
    end.getUint32(4, true) !== 0 ||
    end.getUint16(8, true) !== entryCount ||
    entryCount === 0 ||
    end.getUint16(20, true) !== 0 ||
    directoryLength === 0 ||
    directoryOffset + directoryLength !== endOffset
  ) {
    throw new Error("unconfirmed");
  }
}

/** 服务端核对每个对象的字节，浏览器再检查交付格式，避免把异常页面保存成 ZIP。 */
export async function downloadExplorerArchive(items: readonly ExplorerTarget[]) {
  const response = await fetch("/api/document-library/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const failure = await response.json();
    throw new Error(failure.error ?? "unconfirmed");
  }

  const content = await response.blob();
  await verifyZipFraming(content);
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = "PT5-documents.zip";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
