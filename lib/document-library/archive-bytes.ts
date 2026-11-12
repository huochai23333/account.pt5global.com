import { Zip, ZipPassThrough } from "fflate";

/** 每条路径直接写入 ZIP，避免特殊文件名被当作对象属性而漏项。 */
export function archiveBytes(entries: ReadonlyMap<string, Uint8Array>) {
  const chunks: Uint8Array[] = [];
  let failure: Error | null = null;
  let complete = false;
  const archive = new Zip((error, bytes, final) => {
    if (error) {
      failure = error;
      return;
    }
    chunks.push(bytes);
    if (final) complete = true;
  });

  for (const [path, bytes] of entries) {
    const file = new ZipPassThrough(path);
    archive.add(file);
    file.push(bytes, true);
  }
  archive.end();
  // ZipPassThrough 同步交付结尾。若生成器失败或未结束，就不能拼接成下载结果。
  if (failure) throw failure;
  if (!complete) throw new Error("unconfirmed");

  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
