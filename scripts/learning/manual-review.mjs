import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readModuleMap, repositoryRoots, webRoot } from "./catalogue.mjs";

export const reviewFile = path.join(
  webRoot,
  "docs/onboarding/manual-review.json",
);
const restricted = /\/(accounts|local-supabase-admin)\.ts$/;
const reviewed = new Set(["retained", "refactored"]);

/** 状态必须由审查者填写；生成器只能补待审项，不能把自动抽取冒充人工判断。 */
export function validateManualReviews(
  records,
  expected,
  roots = repositoryRoots,
  requireComplete = false,
) {
  const errors = [];
  const seen = new Set();
  for (const entry of records) {
    const key = `${entry.repo}:${entry.file}`;
    if (seen.has(key)) errors.push(`人工审查重复：${key}`);
    seen.add(key);
    if (!expected.has(key)) errors.push(`人工审查引用已移除源码：${key}`);
    if (!roots[entry.repo]) {
      errors.push(`人工审查仓库无效：${key}`);
      continue;
    }
    const target = path.resolve(roots[entry.repo], entry.file);
    if (!target.startsWith(path.resolve(roots[entry.repo]) + path.sep)) {
      errors.push(`人工审查路径越界：${key}`);
      continue;
    }
    if (!fs.existsSync(target)) {
      errors.push(`人工审查源码不存在：${key}`);
      continue;
    }
    if (reviewed.has(entry.status)) {
      if (restricted.test(entry.file)) {
        errors.push(`受限入口不能自动记为已审查：${key}`);
        continue;
      }
      const hash = createHash("sha256")
        .update(fs.readFileSync(target))
        .digest("hex");
      if (entry.sha256 !== hash) errors.push(`人工审查摘要过期：${key}`);
      for (const field of [
        "reason",
        "dataFlow",
        "permissionBoundary",
        "reviewer",
        "reviewMethod",
      ]) {
        if (!entry[field]?.trim()) errors.push(`人工审查缺少 ${field}：${key}`);
      }
      if (!entry.responsibilities?.length || entry.responsibilities.length > 3)
        errors.push(`人工审查职责不清或需要拆分：${key}`);
      if (!entry.verification?.length)
        errors.push(`人工审查缺少验证入口：${key}`);
    } else if (!["pending", "blocked"].includes(entry.status))
      errors.push(`人工审查状态无效：${key}`);
    if (requireComplete && !reviewed.has(entry.status))
      errors.push(`人工审查尚未完成：${key}`);
  }
  for (const key of expected)
    if (!seen.has(key)) errors.push(`人工审查尚未登记：${key}`);
  return errors;
}

export function expectedReviewKeys(map) {
  return new Set(
    map.modules.flatMap((entry) =>
      Object.entries(entry.sources).flatMap(([repo, files]) =>
        files.map((file) => `${repo}:${file}`),
      ),
    ),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.join(webRoot, "scripts/learning/manual-review.mjs")
) {
  if (!process.argv.includes("--seed"))
    throw new Error("仅 --seed 补全待审清单；不会批准任何文件。");
  const previous = fs.existsSync(reviewFile)
    ? JSON.parse(fs.readFileSync(reviewFile, "utf8"))
    : { records: [] };
  const prior = new Map(
    previous.records.map((entry) => [`${entry.repo}:${entry.file}`, entry]),
  );
  const map = readModuleMap();
  const records = map.modules.flatMap((entry) =>
    Object.entries(entry.sources).flatMap(([repo, files]) =>
      files.map((file) => {
        const old = prior.get(`${repo}:${file}`);
        if (old) return { ...old, module: entry.id };
        return {
          repo,
          file,
          module: entry.id,
          status: restricted.test(file) ? "blocked" : "pending",
          sha256: null,
          responsibilities: [],
          reason: restricted.test(file) ? "既有辅助入口读取限制仍保留" : "",
          dataFlow: "",
          permissionBoundary: "",
          verification: [],
          unresolved: [],
          reviewer: "",
          reviewMethod: "",
        };
      }),
    ),
  );
  fs.writeFileSync(
    reviewFile,
    JSON.stringify(
      { kind: "explicit_source_responsibility_review", records },
      null,
      2,
    ) + "\n",
  );
  console.log({
    registered: records.length,
    reviewed: records.filter((entry) => reviewed.has(entry.status)).length,
  });
}
