import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repositoryRoots } from "./catalogue.mjs";

/** 写入机器清单、静态扫描和迁移历史；不会改动源码、当前数据库或人工审查状态。 */
export function writeLearningIndexes(
  { modules, review, database },
  roots = repositoryRoots,
) {
  const home = path.join(roots.web, "docs/onboarding");
  const webRoot = roots.web;
  const mapFile = path.join(home, "module-map.json");
  const documents = [
    "README.md",
    "CONTRIBUTING.md",
    "docs/reference/maintenance-handbook.md",
    "../PT5-dropshipping-supabase/README.md",
    "../PT5-dropshipping-supabase/CONTRIBUTING.md",
    "../PT5-dropshipping-supabase/docs/reference/maintenance-handbook.md",
  ];
  function listDocuments(directory) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) listDocuments(target);
      else if (entry.name.endsWith(".md"))
        documents.push(path.relative(webRoot, target).replaceAll("\\", "/"));
    }
  }
  listDocuments(home);
  listDocuments(path.join(roots.supabase, "docs/onboarding"));
  writeFileSync(
    mapFile,
    JSON.stringify(
      {
        schemaVersion: 1,
        description: "模块归属与学习说明；路径覆盖不等同业务验收。",
        documents: [...new Set(documents)].sort(),
        modules,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(home, "source-review.json"),
    JSON.stringify(
      { kind: "static_structure_scan", records: review },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(roots.supabase, "docs/onboarding/database-index.json"),
    JSON.stringify(
      {
        kind: "migration_definition_history",
        warning:
          "此索引列出历史定义，不是当前生效数据库；同名函数可能多次定义或被删除。以本地实际目录和迁移集合为准。",
        migrations: database,
      },
      null,
      2,
    ) + "\n",
  );
}
