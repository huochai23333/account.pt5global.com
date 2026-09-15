import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const contracts = JSON.parse(await readFile(path.join(root, "config", "operation-contracts.json"), "utf8"));
const violations = [];
const coveredSources = new Set(
  contracts.flatMap((contract) => contract.sources ?? []).map((source) => source.replaceAll("\\", "/")),
);
const requiredFields = ["operationId", "trigger", "completionEvidence", "timeoutSeconds", "retryDelaysSeconds", "idempotency", "failureMessage", "ownerRole", "sources"];

for (const contract of contracts) {
  for (const field of requiredFields) {
    if (!(field in contract) || contract[field] === "") violations.push(`${contract.operationId ?? "unknown"}: 缺少 ${field}`);
  }
  for (const source of contract.sources ?? []) {
    try { await access(path.join(root, source)); } catch { violations.push(`${contract.operationId}: 来源文件不存在 ${source}`); }
  }
}

const files = await collectFiles(["app", "components", "lib"]);
for (const file of files) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && isAwaitedFetch(node.initializer)
    ) {
      const responseName = node.name.text;
      const scopeText = findContainingBlock(node).getText(sourceFile);
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      if (!scopeText.includes(`${responseName}.ok`)) {
        violations.push(`${relative}:${line}: fetch 响应没有检查 HTTP 完成状态。`);
      }

      const fetchText = node.initializer.getText(sourceFile);
      if (/method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i.test(fetchText) && !coveredSources.has(relative)) {
        violations.push(`${relative}: 产生副作用的 HTTP 请求没有登记到操作清单。`);
        coveredSources.add(relative);
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (["insert", "update", "delete", "upsert"].includes(method)) {
        const statement = findStatement(node);
        const text = statement.getText(sourceFile);
        // 只检查 Supabase 的 `.from(...).update(...)` 调用链。过去通过整条语句搜索
        // `.from(`，会把同一语句里的 `Buffer.from(...)` 误判成数据库写入。
        if (callChainHasMethod(node.expression.expression, "from")) {
          if (!coveredSources.has(relative)) {
            violations.push(`${relative}: 数据库写入没有登记到操作清单。`);
            coveredSources.add(relative);
          }
        }
        if (callChainHasMethod(node.expression.expression, "from") && !text.includes(".select(")) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          const nearby = source.split(/\r?\n/).slice(Math.max(0, line - 3), line + 8).join("\n");
          if (!nearby.includes("verified-write:")) violations.push(`${relative}:${line}: ${method} 必须返回受影响记录，或注明 verified-write 后立即查询核对。`);
        }
      }

      if (method === "rpc" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const rpcName = node.arguments[0].text;
        if (/^(create|update|delete|save|set|approve|deny|mark|submit|reject|cancel|accept|complete|manage|add|assign|change|end|replace|clear|link|reopen|return|claim|release|request|register|review|record|deactivate)_/.test(rpcName)) {
          if (!coveredSources.has(relative)) {
            violations.push(`${relative}: 写入型 RPC 没有登记到操作清单。`);
            coveredSources.add(relative);
          }
          const statementText = findStatement(node).getText(sourceFile);
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          const nearby = source.split(/\r?\n/).slice(Math.max(0, line - 3), line + 12).join("\n");
          // `callRpc` 是库存弹窗统一使用的强校验器：它会读取 data，并拒绝空回执。
          const checkedBySharedHelper = statementText.includes("callRpc(");
          if (!/\bdata\b/.test(statementText) && !checkedBySharedHelper && !nearby.includes("verified-rpc:")) {
            violations.push(`${relative}:${line}: 写入型 RPC ${rpcName} 没有读取业务回执。`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

if (violations.length) {
  console.error(["操作成功契约检查失败：", ...violations.map((item) => `- ${item}`)].join("\n"));
  process.exitCode = 1;
} else {
  console.log(`操作成功契约检查通过：${contracts.length} 项关键契约，${files.length} 个源码文件。`);
}

function findStatement(node) {
  let current = node;
  while (current.parent && !ts.isStatement(current)) current = current.parent;
  return current;
}

function findContainingBlock(node) {
  let current = node;
  while (current.parent && !ts.isBlock(current)) current = current.parent;
  return current;
}

function isAwaitedFetch(node) {
  return ts.isAwaitExpression(node)
    && ts.isCallExpression(node.expression)
    && ts.isIdentifier(node.expression.expression)
    && node.expression.expression.text === "fetch";
}

function callChainHasMethod(node, expectedMethod) {
  let current = node;

  while (current) {
    if (
      ts.isCallExpression(current)
      && ts.isPropertyAccessExpression(current.expression)
      && current.expression.name.text === expectedMethod
    ) {
      return true;
    }

    if (ts.isCallExpression(current)) {
      current = current.expression;
      continue;
    }

    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression;
      continue;
    }

    break;
  }

  return false;
}

async function collectFiles(directories) {
  const found = [];
  async function walk(directory) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(relative);
      else if (/\.tsx?$/.test(entry.name)) found.push(path.join(root, relative));
    }
  }
  for (const directory of directories) await walk(directory);
  return found;
}
