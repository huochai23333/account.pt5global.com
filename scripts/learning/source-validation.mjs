import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { discoverSources, repositoryRoots } from "./catalogue.mjs";

/** 源码修改后旧扫描不能继续充当当前证据，必须重新生成并评审。 */
export function validateSourceReview(records, roots = repositoryRoots) {
  const errors = [];
  for (const record of records) {
    const file = path.resolve(roots[record.repo], record.file);
    if (!existsSync(file)) {
      errors.push(`结构扫描引用了已移除文件：${record.file}`);
      continue;
    }
    const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (hash !== record.sha256)
      errors.push(`结构扫描已过期，请刷新并评审：${record.file}`);
    if (record.parseErrors || record.lines > 400)
      errors.push(`结构扫描存在待处理项：${record.file}`);
  }
  return errors;
}

/** 当前数据库索引同时绑定迁移集合与内容，不能仅凭版本总数继续使用旧结构说明。 */
export function validateDatabaseSnapshot() {
  const errors = [];
  // 数据库关系索引绑定迁移内容；增加或修改迁移后，旧快照不能继续作为当前结构说明。
  const schema = JSON.parse(
    readFileSync(
      path.join(
        repositoryRoots.supabase,
        "docs/onboarding/database-current.json",
      ),
      "utf8",
    ),
  );
  const migrationPaths = discoverSources("supabase").filter((file) =>
    file.startsWith("supabase/migrations/"),
  );
  const snapshotPaths = schema.migrations.map(
    (entry) => `supabase/migrations/${entry.file}`,
  );
  if (
    JSON.stringify(migrationPaths) !== JSON.stringify([...snapshotPaths].sort())
  ) {
    errors.push("当前数据库结构索引的迁移集合已过期，请先验证本地迁移再导出。");
  }
  errors.push(
    ...validateSourceReview(
      schema.migrations.map((entry) => ({
        repo: "supabase",
        file: `supabase/migrations/${entry.file}`,
        sha256: entry.sha256,
      })),
    ),
  );
  return errors;
}
