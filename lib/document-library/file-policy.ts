import { createHash } from "node:crypto";
import { OTHER_UPLOAD_MAX_SIZE_BYTES, exceedsUploadFileSizeLimit } from "@/lib/upload-file-size-limits";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", pdf: "application/pdf",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv", txt: "text/plain", zip: "application/zip", mp4: "video/mp4", mov: "video/quicktime",
  webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo",
};
const ZIP_TYPES = new Set(["zip", "docx", "xlsx", "pptx"]);
const OLE_TYPES = new Set(["doc", "xls", "ppt"]);
export const DOCUMENT_ACCEPT = Object.keys(TYPES).map((extension) => `.${extension}`).join(",");

/** 扩展名和浏览器 MIME 都可伪造，因此服务端还检查文件头；只对图片和 PDF 开放预览。 */
export function inspectDocument(name: string, bytes: Uint8Array) {
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  const mime = TYPES[extension];
  if (!mime || name.length > 200 || /[/\\\x00-\x1f]/.test(name) || !bytes.length) throw new Error("invalid");
  if (exceedsUploadFileSizeLimit({ name, size: bytes.length, type: mime }) || (!mime.startsWith("image/") && !mime.startsWith("video/") && bytes.length > OTHER_UPLOAD_MAX_SIZE_BYTES)) throw new Error("size");
  const hex = Buffer.from(bytes.subarray(0, 12)).toString("hex");
  const ascii = Buffer.from(bytes.subarray(0, 12)).toString("latin1");
  let valid = true;
  if (extension === "pdf") valid = ascii.startsWith("%PDF-");
  else if (extension === "png") valid = hex.startsWith("89504e470d0a1a0a");
  else if (extension === "jpg" || extension === "jpeg") valid = hex.startsWith("ffd8ff");
  else if (extension === "gif") valid = ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
  else if (extension === "webp") valid = ascii.startsWith("RIFF") && ascii.slice(8) === "WEBP";
  else if (ZIP_TYPES.has(extension)) valid = hex.startsWith("504b0304") || hex.startsWith("504b0506");
  else if (OLE_TYPES.has(extension)) valid = hex.startsWith("d0cf11e0a1b11ae1");
  else if (extension === "mp4" || extension === "mov") valid = ascii.slice(4, 8) === "ftyp";
  else if (extension === "webm" || extension === "mkv") valid = hex.startsWith("1a45dfa3");
  else if (extension === "avi") valid = ascii.startsWith("RIFF") && ascii.slice(8) === "AVI ";
  else if (extension === "csv" || extension === "txt") {
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); valid = !bytes.includes(0); } catch { valid = false; }
  }
  if (!valid) throw new Error("invalid");
  return { mime, sha256: createHash("sha256").update(bytes).digest("hex") };
}
