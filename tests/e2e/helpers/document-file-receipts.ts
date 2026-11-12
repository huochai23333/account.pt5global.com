import { expect } from "@playwright/test";
import { appendFileSync } from "node:fs";
import type { DocumentFile } from "@/lib/document-library/model";
import { documentAdmin } from "./document-access";

/** 直接核对权威文件记录与对象，不把上传提示单独视为完成。 */
export async function authoritativeFiles(names: string[]) {
  const result = await documentAdmin()
    .from("document_files")
    .select("*")
    .in("name", names);
  expect(result.error).toBeNull();
  // 只记录测试夹具的安全业务凭证；密钥、认证会话与实际文件正文不进入交付记录。
  appendFileSync(
    "output/document-library-business-receipts.jsonl",
    JSON.stringify({
      checkedAt: new Date().toISOString(),
      names,
      files: result.data?.map((file) => ({
        id: file.id,
        version: file.version,
        folderId: file.folder_id,
        path: file.storage_path,
        size: file.size_bytes,
        status: file.status,
      })),
    }) + "\n",
  );
  return result.data as DocumentFile[];
}

export async function confirmFileObjects(files: DocumentFile[]) {
  for (const file of files) {
    expect(file.status).toBe("ready");
    expect(file.version).toBeGreaterThan(1);
    const object = await documentAdmin()
      .storage.from("document-library")
      .download(file.storage_path);
    expect(object.error).toBeNull();
    expect(object.data?.size).toBe(file.size_bytes);
  }
}

export function documentPdf() {
  const stream = "BT /F1 12 Tf 15 150 Td (Document verification) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(content);
  content += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => String(offset).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(content);
}
