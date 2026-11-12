import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveBytes } from "./archive-bytes";
import { archivePaths } from "./archive-paths";
import { readManifest } from "./explorer-repository";
import type { DocumentFile, ExplorerTarget } from "./model";
import { readVerifiedDocumentContent } from "./verified-file-content";

const MAX_ARCHIVE_FILES = 100;
const MAX_ARCHIVE_SOURCE_BYTES = 200 * 1024 * 1024;

/** 打包前逐个校验真实字节。任何对象缺失或内容变化都中止整包。 */
export async function downloadArchive(db: SupabaseClient, items: ExplorerTarget[]) {
  const manifest = await readManifest(db, items, false);
  const files = manifest.entries.filter(({ kind }) => kind === "file");
  const totalBytes = files.reduce((sum, entry) => sum + Number(entry.record.size_bytes), 0);
  if (files.length > MAX_ARCHIVE_FILES || totalBytes > MAX_ARCHIVE_SOURCE_BYTES) {
    throw new Error("archiveSize");
  }
  if (!files.length && !manifest.entries.some(({ kind }) => kind === "folder")) {
    throw new Error("templateDownload");
  }

  const bundle = new Map<string, Uint8Array>();
  const paths = archivePaths(manifest.entries);
  for (const entry of manifest.entries) {
    if (entry.kind === "template") continue;
    const path = paths.get(entry.id);
    if (!path) throw new Error("unconfirmed");

    if (entry.kind === "folder") {
      bundle.set(path, new Uint8Array());
      continue;
    }
    const { bytes } = await readVerifiedDocumentContent(db, entry.record as unknown as DocumentFile);
    bundle.set(path, bytes);
  }

  // 读完后重新核对清单，拦截打包过程中移动、撤权或修改内容。
  const confirmed = await readManifest(db, items, false);
  if (confirmed.digest !== manifest.digest) throw new Error("conflict");
  return archiveBytes(bundle);
}
