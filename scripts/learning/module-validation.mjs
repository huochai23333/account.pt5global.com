import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { discoverSources, repositoryRoots, webRoot } from "./catalogue.mjs";

/** 学习地图属于维护合同：漏登记、重复归属或指向不存在的文件时立即失败。 */
export function validateModuleMap(
  map,
  roots = repositoryRoots,
  discovered = null,
) {
  const errors = [];
  const owners = new Map();
  const ids = new Set();
  for (const entry of map.modules) {
    if (ids.has(entry.id)) errors.push(`模块编号重复：${entry.id}`);
    ids.add(entry.id);
    for (const field of [
      "title",
      "status",
      "purpose",
      "flow",
      "permissions",
      "evidence",
      "maintenance",
      "guide",
    ]) {
      if (!entry[field]) errors.push(`${entry.id} 缺少 ${field}`);
    }
    if (!existsSync(path.resolve(roots.web, entry.guide)))
      errors.push(`模块指南不存在：${entry.guide}`);
    for (const [repo, tests] of Object.entries(entry.tests ?? {})) {
      for (const file of tests) {
        if (!roots[repo] || !existsSync(path.resolve(roots[repo], file)))
          errors.push(`关联测试不存在：${repo}:${file}`);
      }
    }
    for (const repo of Object.keys(roots)) {
      for (const file of entry.sources[repo] ?? []) {
        const key = `${repo}:${file}`;
        if (owners.has(key))
          errors.push(`${key} 重复归属于 ${owners.get(key)} 和 ${entry.id}`);
        owners.set(key, entry.id);
        const target = path.resolve(roots[repo], file);
        if (
          !target.startsWith(path.resolve(roots[repo]) + path.sep) ||
          !existsSync(target)
        ) {
          errors.push(`源码不存在或越界：${key}`);
        } else if (
          !realpathSync(target).startsWith(realpathSync(roots[repo]) + path.sep)
        ) {
          errors.push(`源码链接越界：${key}`);
        }
      }
    }
  }
  for (const repo of Object.keys(roots)) {
    for (const file of discovered?.[repo] ?? discoverSources(repo)) {
      if (!owners.has(`${repo}:${file}`))
        errors.push(`新源码尚未登记模块：${repo}:${file}`);
    }
  }
  return errors;
}

export function validateMarkdownLinks(files) {
  const errors = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const raw = match[1].replace(/^<|>$/g, "").split(/\s+"/)[0];
      if (/^(https?:|mailto:|#)/.test(raw)) continue;
      const target = decodeURIComponent(raw.split("#")[0]);
      if (target && !existsSync(path.resolve(path.dirname(file), target))) {
        errors.push(
          `文档链接失效：${path.relative(webRoot, file)} -> ${target}`,
        );
      }
    }
  }
  return errors;
}
