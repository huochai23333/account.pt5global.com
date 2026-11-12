import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, readdirSync } from "node:fs";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { compareE2eCohorts } from "./learning/e2e-cohorts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testsRoot = resolve(root, "tests");
const restricted = new Set(["accounts.ts", "local-supabase-admin.ts"]);
const cache = new Map();
const slash = (value) => value.replaceAll("\\", "/");

// 只读取测试源码文本。拒绝文件在 realpath 前后各检查一次，绝不导入、求值或执行测试。
function inspectSource(path) {
  assert(!restricted.has(basename(path).toLowerCase()), "restricted source cannot be inspected");
  const actual = realpathSync(path);
  assert(
    !restricted.has(basename(actual).toLowerCase()),
    "restricted real source cannot be inspected",
  );
  assert(
    [".ts", ".tsx", ".mjs", ".js"].includes(extname(actual)),
    "environment and fixture data files cannot be inspected",
  );
  assert(actual.startsWith(testsRoot + sep), "only test sources may enter the import graph");
  if (cache.has(actual)) return cache.get(actual);
  const source = readFileSync(actual, "utf8");
  const ast = ts.createSourceFile(actual, source, ts.ScriptTarget.Latest, true);
  const imports = [];
  const dynamicImports = [];
  const roles = new Set();
  const routes = new Set();
  const line = (node) => ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push({ module: node.moduleSpecifier.text, line: line(node) });
    }
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(ast);
      if (call === "require" || node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (ts.isStringLiteral(node.arguments[0]))
          imports.push({ module: node.arguments[0].text, line: line(node) });
        else dynamicImports.push(line(node));
      }
      if (/loginAs$/.test(call) && node.arguments[1] && ts.isStringLiteral(node.arguments[1]))
        roles.add(node.arguments[1].text);
      if (
        /\.goto$/.test(call) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text.startsWith("/")
      )
        routes.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const result = {
    file: slash(relative(root, actual)),
    sha256: createHash("sha256").update(source).digest("hex"),
    imports,
    dynamicImports,
    roles: [...roles],
    routes: [...routes],
  };
  cache.set(actual, result);
  return result;
}

function localTarget(file, module) {
  // 不追踪产品模块、第三方包、环境文件或数据文件；它们不是此次拒绝边界审计的执行入口。
  if (!module.startsWith(".")) return null;
  const base = resolve(dirname(file), module);
  if (!base.startsWith(testsRoot + sep)) return null;
  const candidates = extname(base)
    ? [base]
    : [".ts", ".tsx", ".mjs", ".js"].map((ext) => base + ext).concat(resolve(base, "index.ts"));
  return (
    candidates.find(
      (path) => [".ts", ".tsx", ".mjs", ".js"].includes(extname(path)) && existsSync(path),
    ) ?? null
  );
}

function inspectDependencies(entry) {
  const found = new Map();
  const visited = new Set();
  const unresolved = [];
  function walk(file, chain) {
    if (restricted.has(basename(file).toLowerCase())) {
      if (!found.has(basename(file).toLowerCase())) found.set(basename(file).toLowerCase(), chain);
      return; // 必须在读取前停下；没有替换 helper 或另找凭据入口。
    }
    const actual = realpathSync(file);
    if (restricted.has(basename(actual).toLowerCase())) {
      if (!found.has(basename(actual).toLowerCase()))
        found.set(basename(actual).toLowerCase(), chain);
      return;
    }
    if (visited.has(actual)) return;
    visited.add(actual);
    const info = inspectSource(actual);
    for (const item of info.imports) {
      const target = localTarget(actual, item.module);
      if (target)
        walk(target, [...chain, { file: info.file, line: item.line, module: item.module }]);
      else if (item.module.startsWith(".")) unresolved.push({ file: info.file, ...item });
    }
  }
  walk(entry, []);
  return {
    restricted: [...found].map(([helper, chain]) => ({ helper, chain })),
    unresolvedLocalImports: unresolved,
    inspectedFiles: visited.size,
  };
}

const previous = readFileSync(resolve(root, "docs/test-reliability-follow-up.md"), "utf8");
const unexecuted = [...previous.matchAll(/^\| `([^`]+\.spec\.ts)` \| blocked \|/gm)].map(
  (match) => match[1],
);
const failed = [
  "dashboard-home-role-tasks.spec.ts",
  "information-hierarchy.spec.ts",
  "dashboard-home-resize.spec.ts",
];
const catalogue = readdirSync(resolve(root, "tests/e2e")).filter((file) =>
  file.endsWith(".spec.ts"),
);
// 固定历史集合来自已核对的 Git 树；当前目录新增测试不应令历史审计失效。
const cohort = JSON.parse(readFileSync(resolve(root, "config/e2e-historical-cohort.json"), "utf8"));
assert.equal(cohort.files.length, 86, "历史集合应保留原 86 个文件");
const cohortChanges = compareE2eCohorts(cohort.files, catalogue, cohort.renames);
assert.equal(
  new Set(unexecuted).size,
  57,
  "ledger must contain exactly 57 distinct unexecuted files",
);
const blockers = readFileSync(resolve(root, "docs/real-e2e-blockers.md"), "utf8");
const mapped = [...blockers.matchAll(/^\| `([^`]+\.spec\.ts)` \| (unrun|failed) \|.*$/gm)].map(
  (match) => {
    const cells = match[0].split("|").map((cell) => cell.trim());
    const isUnrun = match[2] === "unrun";
    const capabilities = isUnrun ? cells[3] : "H; final readback separately restricted";
    if (isUnrun) {
      assert(
        ["H+A", "H；无 A", "H；无 A；另有执行拒绝"].includes(capabilities),
        `历史台账能力格式无法识别：${match[1]}`,
      );
    }
    // 失败表第三列记录已知失败，未执行表第三列记录能力；不能混用两种列语义。
    const prerequisites = cells[isUnrun ? 4 : 3];
    const userPreparation = cells[isUnrun ? 5 : 4];
    assert(
      prerequisites.length > 8 && /M[1-7]/.test(userPreparation),
      "each row needs concrete prerequisites and a user preparation action",
    );
    return {
      file: match[1],
      state: match[2],
      capabilities,
      prerequisites,
      userPreparation,
      ...(isUnrun ? {} : { requiredFinalProof: cells[5] }),
    };
  },
);
assert.equal(
  mapped.length,
  60,
  "all 57 unexecuted files and three failed files need explicit rows",
);
assert.deepEqual(
  mapped
    .filter((item) => item.state === "unrun")
    .map((item) => item.file)
    .sort(),
  [...unexecuted].sort(),
);
assert.deepEqual(
  mapped
    .filter((item) => item.state === "failed")
    .map((item) => item.file)
    .sort(),
  [...failed].sort(),
);
const entries = mapped.map((item) => {
  assert(cohort.files.includes(item.file), `历史台账入口不在原始集合：${item.file}`);
  const currentFile = cohort.renames[item.file] ?? item.file;
  const entry = resolve(root, "tests/e2e", currentFile);
  // 已移除的入口仍属于历史台账，但没有当前源码，不能生成当前依赖或通过结论。
  if (!existsSync(entry)) {
    return {
      ...item,
      currentFile: null,
      source: null,
      dependencies: { restricted: [], unresolvedLocalImports: [], inspectedFiles: 0 },
      execution: "source_removed",
    };
  }
  const dependencies = inspectDependencies(entry);
  return { ...item, currentFile, source: inspectSource(entry), dependencies, execution: "not_run" };
});
// 历史准备条件对应原审计，当前源码可能已经改用其他夹具。保留历史记录并逐项显示变化。
const prerequisiteChanges = entries.flatMap((item) => {
  if (item.state !== "unrun" || !item.currentFile) return [];
  const recorded = item.capabilities === "H+A" ? ["H", "A"] : ["H"];
  const detected = [];
  if (item.dependencies.restricted.some((dep) => dep.helper === "accounts.ts")) detected.push("H");
  if (item.dependencies.restricted.some((dep) => dep.helper === "local-supabase-admin.ts")) detected.push("A");
  if (recorded.join(",") === detected.join(",")) return [];
  return [{ historicalFile: item.file, currentFile: item.currentFile, recorded, detected }];
});
// 当前新增入口另行扫描依赖；静态准备条件不代表获准执行或已经通过。
const currentEntries = catalogue.sort().map((file) => ({
  file,
  dependencies: inspectDependencies(resolve(root, "tests/e2e", file)),
  execution: "not_run",
}));
// 这是源码与台账一致性检查，不是测试执行结果；绝不把静态依赖检查记为 E2E 通过。
console.log(
  JSON.stringify(
    {
      kind: "static_prerequisite_audit",
      originalFiles: cohort.files.length,
      currentFiles: catalogue.length,
      cohortSource: cohort.sourceCommit,
      cohortChanges,
      prerequisiteChanges,
      currentEntries,
      unexecutedFiles: unexecuted.length,
      failedFiles: failed.length,
      credentialFilesRead: 0,
      entries,
    },
    null,
    2,
  ),
);
