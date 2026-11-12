import type { ManifestEntry } from "./model";

/** 同名目录来自不同档案时各保留一份，后代按父目录编号定位。 */
export function archivePaths(entries: ManifestEntry[]) {
  const paths = new Map<string, string>();
  const folderPaths = new Map<string, string>();
  const usedPaths = new Set<string>();

  function allocate(parent: string, name: string, folder: boolean) {
    const base = name.replace(/[/\\\u0000-\u001f]/g, "_").replace(/^\.+$/, "_");
    const dot = folder ? -1 : base.lastIndexOf(".");
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const extension = dot > 0 ? base.slice(dot) : "";
    let candidate = base;
    let suffix = 1;

    // Windows 常按不区分大小写的方式解压。文件和目录使用同一份占用表。
    const key = (value: string) => (parent + value).normalize("NFC").toLowerCase();
    while (usedPaths.has(key(candidate))) {
      suffix += 1;
      candidate = `${stem} (${suffix})${extension}`;
    }
    usedPaths.add(key(candidate));
    return parent + candidate + (folder ? "/" : "");
  }

  // 先为父目录分配路径，使子项始终使用父目录最终的名字。
  const folders = entries
    .filter(({ kind }) => kind === "folder")
    .sort((left, right) => left.path.length - right.path.length || left.id.localeCompare(right.id));
  for (const entry of folders) {
    const parent = folderPaths.get(String(entry.record.parent_id)) ?? "";
    const path = allocate(parent, entry.record.name, true);
    folderPaths.set(entry.id, path);
    paths.set(entry.id, path);
  }
  for (const entry of entries.filter(({ kind }) => kind === "file")) {
    paths.set(entry.id, allocate(folderPaths.get(entry.folderId) ?? "", entry.record.name, false));
  }
  return paths;
}
