import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const contracts = JSON.parse(await readFile(path.join(root, "config", "operation-contracts.json"), "utf8"));
const violations = [];
const showInventory = process.argv.includes("--inventory");
const inventory = {
  authWrites: [],
  databaseWrites: [],
  edgeFunctionInvokes: [],
  fetches: [],
  rpcs: [],
  storageWrites: [],
};
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
    if (ts.isCallExpression(node)) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

      if (ts.isIdentifier(node.expression) && node.expression.text === "fetch") {
        inventory.fetches.push({ file: relative, line });
      }

      if (ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (["upload", "remove", "update", "move", "copy"].includes(method)
          && callChainHasMethod(node.expression.expression, "from")
          && callChainHasProperty(node.expression.expression, "storage")) {
          inventory.storageWrites.push({ file: relative, line, method });
          if (!coveredSources.has(relative)) {
            violations.push(`${relative}:${line}: Storage 写入没有登记到操作清单。`);
          }

          const scopeText = findContainingBlock(node).getText(sourceFile);
          if (method === "upload" && !scopeText.includes("requireStorageUploadReceipt(")) {
            violations.push(`${relative}:${line}: Storage 上传没有核对返回的对象路径。`);
          }
          if (method === "remove" && relative !== "lib/storage-operation-receipts.ts") {
            violations.push(`${relative}:${line}: Storage 删除必须通过统一方法确认对象已经不存在。`);
          }
        }

        if ([
          "signUp",
          "signInWithOAuth",
          "signOut",
          "updateUser",
          "resetPasswordForEmail",
          "verifyOtp",
          "exchangeCodeForSession",
        ].includes(method) && callChainHasProperty(node.expression.expression, "auth")) {
          inventory.authWrites.push({ file: relative, line, method });
          if (!coveredSources.has(relative)) {
            violations.push(`${relative}:${line}: Auth 副作用没有登记到操作清单。`);
          }

          const statementText = findStatement(node).getText(sourceFile);
          const nearby = source.split(/\r?\n/).slice(Math.max(0, line - 3), line + 12).join("\n");
          if (method === "signOut") {
            const blockText = findContainingBlock(node).getText(sourceFile);
            if (
              !nearby.includes("verified-auth-signout:")
              && !blockText.includes("requireSignedOutSessionReceipt(")
            ) {
              violations.push(`${relative}:${line}: 退出账号后没有确认会话已经清除。`);
            }
          } else {
            const blockText = findContainingBlock(node).getText(sourceFile);
            if (!/\bdata\b/.test(statementText)) {
              violations.push(`${relative}:${line}: Auth 副作用 ${method} 没有读取业务回执。`);
            }
            if (
              method === "resetPasswordForEmail"
              && !blockText.includes("requireAuthRequestAccepted(")
            ) {
              violations.push(`${relative}:${line}: 找回密码请求没有校验 Auth 接受回执。`);
            }
            if (
              ["signUp", "updateUser", "verifyOtp"].includes(method)
              && !blockText.includes("requireAuthUserReceipt(")
            ) {
              violations.push(`${relative}:${line}: Auth 副作用 ${method} 没有校验权威用户编号。`);
            }
          }
        }

        if (method === "invoke" && callChainHasProperty(node.expression.expression, "functions")) {
          inventory.edgeFunctionInvokes.push({
            file: relative,
            functionName: readStringArgument(node.arguments[0]),
            line,
          });
          if (!coveredSources.has(relative)) {
            violations.push(`${relative}:${line}: Edge Function 派发没有登记到操作清单。`);
          }
          const statementText = findStatement(node).getText(sourceFile);
          if (!/\bdata\b/.test(statementText)) {
            violations.push(`${relative}:${line}: Edge Function 派发没有读取业务完成回执。`);
          }
        }
      }
    }

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
          inventory.databaseWrites.push({ file: relative, line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1, method });
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
        if (
          callChainHasMethod(node.expression.expression, "from")
          && text.includes(".select(")
          && !/\bdata\b/.test(text)
        ) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          violations.push(`${relative}:${line}: ${method} 虽然请求返回记录，但调用方没有接收业务回执。`);
        }
      }

      if (method === "rpc" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const rpcName = node.arguments[0].text;
        inventory.rpcs.push({
          file: relative,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          rpcName,
          writeLike: isWriteLikeRpc(rpcName),
        });
        if (isWriteLikeRpc(rpcName)) {
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

if (showInventory) {
  // 清单按文件和行号排序，便于人工复核；这里只输出位置和调用类型，不输出业务数据。
  for (const items of Object.values(inventory)) {
    items.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
  }
  console.log(JSON.stringify({
    counts: Object.fromEntries(
      Object.entries(inventory).map(([key, items]) => [key, items.length]),
    ),
    inventory,
  }, null, 2));
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

function callChainHasProperty(node, expectedProperty) {
  let current = node;
  while (current) {
    if (ts.isPropertyAccessExpression(current)) {
      if (current.name.text === expectedProperty) return true;
      current = current.expression;
      continue;
    }
    if (ts.isCallExpression(current)) {
      current = current.expression;
      continue;
    }
    break;
  }
  return false;
}

function readStringArgument(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : "dynamic";
}

function isWriteLikeRpc(rpcName) {
  return /^(create|update|delete|save|set|approve|deny|mark|submit|reject|cancel|accept|acknowledge|acquire|complete|finish|manage|add|assign|change|end|replace|clear|link|reopen|return|claim|release|request|register|review|record|deactivate|admin_(?:add|set|apply|change|remove))_/.test(rpcName);
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
