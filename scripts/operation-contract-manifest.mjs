import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const textFields = [
  "operationId",
  "trigger",
  "completionEvidence",
  "idempotency",
  "failureMessage",
  "ownerRole",
];
const sourcePath = /^(?:app|components|lib)\/(?:[^/:\0]+\/)*[^/:\0]+\.tsx?$/u;
const backendEntryPath = /^supabase\/functions\/[a-z0-9][a-z0-9-]*\/index\.ts$/u;

/** 校验清单后才允许扫描器把来源视为已登记，避免空回执或无关文件让门禁通过。 */
export async function readOperationContractManifest(root) {
  const workspace = await realpath(root);
  const file = path.join(workspace, "config", "operation-contracts.json");
  const contracts = JSON.parse(await readFile(file, "utf8"));
  const coveredSources = new Set();
  const violations = [];
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return { count: 0, coveredSources, violations: ["操作清单必须包含至少一项契约。"] };
  }

  const operationIds = new Set();
  for (const [index, contract] of contracts.entries()) {
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      violations.push(`第 ${index + 1} 项必须是契约对象。`);
      continue;
    }
    const operationId = typeof contract.operationId === "string" ? contract.operationId.trim() : "";
    const label = operationId || `第 ${index + 1} 项`;
    for (const field of textFields) {
      if (typeof contract[field] !== "string" || !contract[field].trim()) {
        violations.push(`${label}: ${field} 必须是非空文本。`);
      }
    }
    if (operationIds.has(operationId)) violations.push(`${label}: operationId 重复。`);
    if (operationId) operationIds.add(operationId);

    // null 表示该契约没有单独配置超时。空数组表示该操作没有自动重试。
    if (contract.timeoutSeconds !== null && !isPositiveNumber(contract.timeoutSeconds)) {
      violations.push(`${label}: timeoutSeconds 必须是正数或 null。`);
    }
    if (!Array.isArray(contract.retryDelaysSeconds) || !contract.retryDelaysSeconds.every(isPositiveNumber)) {
      violations.push(`${label}: retryDelaysSeconds 必须是正数数组。`);
    }
    // 纯后台任务仍需登记入口，但不计入 Web 调用覆盖，也不要求单独克隆 Web 时存在后端仓库。
    if ("backendEntry" in contract) {
      if (
        typeof contract.backendEntry !== "string" || !backendEntryPath.test(contract.backendEntry)
        || !Array.isArray(contract.sources) || contract.sources.length !== 0
      ) {
        violations.push(`${label}: backendEntry 必须是 Edge Function 入口，且 sources 必须为空数组。`);
      }
      continue;
    }
    if (!Array.isArray(contract.sources) || contract.sources.length === 0) {
      violations.push(`${label}: sources 至少需要一个源码文件。`);
      continue;
    }
    for (const source of contract.sources) {
      const normalized = typeof source === "string" ? source.replaceAll("\\", "/") : "";
      if (!sourcePath.test(normalized) || normalized.split("/").some((part) => part === "." || part === "..")) {
        violations.push(`${label}: sources 不是受检源码路径 ${JSON.stringify(source)}。`);
        continue;
      }
      const target = path.join(workspace, normalized);
      try {
        const resolved = await realpath(target);
        if (path.relative(target, resolved) !== "" || !(await stat(resolved)).isFile()) {
          violations.push(`${label}: sources 必须指向原位置的源码文件 ${normalized}。`);
          continue;
        }
        coveredSources.add(normalized);
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        violations.push(`${label}: 来源文件不存在 ${normalized}。`);
      }
    }
  }

  return { count: contracts.length, coveredSources, violations };
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}
