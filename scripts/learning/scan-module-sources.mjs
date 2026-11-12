import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
  discoverSources,
  repositoryRoots,
  suggestModule,
} from "./catalogue.mjs";

/** 只收集源码事实、结构与历史声明；模块业务判断和明确审查由独立台账维护。 */
export function scanLearningSources(
  moduleDefinitions,
  priorMap,
  { roots = repositoryRoots, discover = discoverSources } = {},
) {
  const modules = moduleDefinitions.map((definition) => ({
    ...definition,
    sources: { web: [], supabase: [] },
    tests: { web: [], supabase: [] },
    entrypoints: [],
    backendObjects: { functions: [], tables: [] },
  }));
  const byId = new Map(modules.map((entry) => [entry.id, entry]));
  const review = [];
  const database = [];
  const priorOwners = new Map(
    priorMap?.modules.flatMap((entry) =>
      Object.entries(entry.sources).flatMap(([repo, files]) =>
        files.map((file) => [`${repo}:${file}`, entry.id]),
      ),
    ) ?? [],
  );

  for (const repo of Object.keys(roots)) {
    for (const file of discover(repo)) {
      const owner =
        priorOwners.get(`${repo}:${file}`) ?? suggestModule(repo, file);
      const entry = byId.get(owner);
      if (!entry) throw new Error(`模块不存在：${owner}`);
      entry.sources[repo].push(file);
      if (/tests\/|\.test\.|\.spec\./.test(file)) {
        const domain = byId.get(
          suggestModule(
            "web",
            `lib/${path.basename(file).replaceAll("_", "-")}`,
          ),
        );
        if (domain && domain.id !== "verification")
          domain.tests[repo].push(file);
      }
      // 受限测试辅助文件只登记路径，绝不为学习索引读取或执行其中的内容。
      if (/\/(accounts|local-supabase-admin)\.ts$/.test(file)) continue;
      const source = readFileSync(path.join(roots[repo], file), "utf8");
      const lines = source.trimEnd().split(/\r?\n/);
      const isRuntime =
        /^(app|components|lib|i18n|supabase\/functions|logistics-supabase\/supabase\/functions|templates)\//.test(
          file,
        );
      if (isRuntime) {
        for (const match of source.matchAll(/\.rpc\(\s*["']([^"']+)["']/g))
          entry.backendObjects.functions.push(match[1]);
        for (const match of source.matchAll(/\.from\(\s*["']([^"']+)["']/g))
          entry.backendObjects.tables.push(match[1]);
        if (/page\.tsx$|index\.ts$|-client\.tsx$/.test(file))
          entry.entrypoints.push({ repo, file });
      }
      if (isRuntime && /\.(ts|tsx|js|mjs|css|html)$/.test(file)) {
        const parsed = /\.(ts|tsx|js|mjs)$/.test(file)
          ? ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
          : null;
        const parseErrors = parsed?.parseDiagnostics.length ?? 0;
        const declarations =
          parsed?.statements
            .filter(
              (statement) =>
                ts.isFunctionDeclaration(statement) ||
                ts.isClassDeclaration(statement),
            )
            .map((statement) => statement.name?.text)
            .filter(Boolean) ?? [];
        review.push({
          repo,
          file,
          module: owner,
          sha256: createHash("sha256").update(source).digest("hex"),
          lines: lines.length,
          longestLine: Math.max(...lines.map((line) => line.length)),
          parseErrors,
          declarations,
          reviewKind: "static_structure_scan",
          finding: parseErrors
            ? "语法错误，必须处理"
            : lines.length > 400
              ? "超过 400 行，需检查职责并拆分"
              : "语法和行数扫描通过；业务职责需结合模块指南与流程验收",
        });
      }
      if (repo === "supabase" && file.startsWith("supabase/migrations/")) {
        const functions = [
          ...source.matchAll(
            /create\s+(?:or\s+replace\s+)?function\s+((?:(?:public|private|document_private)\.)?[a-z_][a-z_0-9]*)\s*\(/gi,
          ),
        ].map((match) => match[1]);
        const tables = [
          ...source.matchAll(
            /create\s+table\s+(?:if\s+not\s+exists\s+)?((?:(?:public|private|document_private)\.)?[a-z_][a-z_0-9]*)/gi,
          ),
        ].map((match) => match[1]);
        database.push({
          file,
          version: path.basename(file).split("_")[0],
          sha256: createHash("sha256").update(source).digest("hex"),
          tables: [...new Set(tables)],
          functions: [...new Set(functions)],
        });
      }
    }
  }

  return { modules, review, database };
}
