import type { WholesaleOrderListUpload } from "./wholesale-order-list-registration";
import type { WholesaleOrderListAttachment } from "./wholesale-order-list-attachments";

// 页面校验与待核对记录共用一份上限，调整规则时不能只修改其中一侧。
export const WHOLESALE_ORDER_LIST_MAX_FILES = 10;
export const WHOLESALE_ORDER_LIST_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const WHOLESALE_ORDER_LIST_MAX_TOTAL_SIZE_BYTES = 100 * 1024 * 1024;
export const WHOLESALE_ORDER_LIST_MIME_TYPES = {
  csv: "text/csv",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export type WholesaleUploadPlan = {
  orderId: string;
  userId: string;
  stage: "uploading" | "registering";
  files: (WholesaleOrderListUpload & { sha256: string })[];
};
type JournalStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const pendingMessage = "附件结果仍需核对，请保留原文件后重试。";

/** 上传或读回未确认时必须保留准确范围，不能重新生成路径或清除可能已写入的对象。 */
export class WholesaleOrderListUploadPending extends Error {
  // 机器调用链保留部分完成标识；页面只展示可理解的核对指引。
  readonly code = "partial_failed";
  constructor(cause: unknown) {
    super(pendingMessage, { cause });
  }
}

function browserStorage(): JournalStorage {
  // 服务端导入模块不会访问浏览器；开始写文件前必须先确保当前标签页能保存核对范围。
  if (typeof window === "undefined")
    throw new Error("本次上传需要在工作台页面中操作。");
  return window.sessionStorage;
}

function key(orderId: string, userId: string) {
  if (!uuid.test(orderId) || !uuid.test(userId))
    throw new Error("附件核对范围无效。");
  return `pt5:wholesale-order-list-upload:${userId}:${orderId}`;
}

/** 这里只保存文件元数据与摘要；没有文件正文、令牌或可用于授权的岗位声明。 */
function parsePlan(
  value: unknown,
  orderId: string,
  userId: string,
): WholesaleUploadPlan {
  if (!value || typeof value !== "object") throw new Error(pendingMessage);
  const plan = value as Partial<WholesaleUploadPlan>;
  if (
    plan.orderId !== orderId ||
    plan.userId !== userId ||
    !["uploading", "registering"].includes(plan.stage ?? "") ||
    !Array.isArray(plan.files) ||
    plan.files.length < 1 ||
    plan.files.length > WHOLESALE_ORDER_LIST_MAX_FILES
  )
    throw new Error(pendingMessage);
  const paths = new Set<string>();
  const files = plan.files.map((file) => {
    if (
      !file ||
      typeof file.storage_path !== "string" ||
      !file.storage_path.startsWith(`${orderId}/${userId}/`) ||
      file.storage_path.split("/").length !== 3 ||
      [".", "..", ""].includes(file.storage_path.split("/")[2] ?? "") ||
      paths.has(file.storage_path) ||
      typeof file.original_name !== "string" ||
      !file.original_name ||
      !(Object.values(WHOLESALE_ORDER_LIST_MIME_TYPES) as string[]).includes(
        file.mime_type,
      ) ||
      !Number.isSafeInteger(file.file_size_bytes) ||
      file.file_size_bytes <= 0 ||
      file.file_size_bytes > WHOLESALE_ORDER_LIST_MAX_FILE_SIZE_BYTES ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw new Error(pendingMessage);
    paths.add(file.storage_path);
    // 显式投影，避免误把调用方的客户端或登录信息写入标签页存储。
    return {
      storage_path: file.storage_path,
      original_name: file.original_name,
      mime_type: file.mime_type,
      file_size_bytes: file.file_size_bytes,
      sha256: file.sha256,
    };
  });
  if (
    files.reduce((total, file) => total + file.file_size_bytes, 0) >
    WHOLESALE_ORDER_LIST_MAX_TOTAL_SIZE_BYTES
  )
    throw new Error(pendingMessage);
  return { orderId, userId, stage: plan.stage!, files };
}

export function readWholesaleUploadPlan(
  orderId: string,
  userId: string,
  storage = browserStorage(),
) {
  const raw = storage.getItem(key(orderId, userId));
  if (raw === null) return null;
  // 无法解释的记录仍代表可能存在未确认写入，不能忽略后另建一批上传。
  if (raw.length > 128000) throw new Error(pendingMessage);
  return parsePlan(JSON.parse(raw), orderId, userId);
}

export function saveWholesaleUploadPlan(
  plan: WholesaleUploadPlan,
  storage = browserStorage(),
) {
  storage.setItem(
    key(plan.orderId, plan.userId),
    JSON.stringify(parsePlan(plan, plan.orderId, plan.userId)),
  );
}

export function clearWholesaleUploadPlan(
  orderId: string,
  userId: string,
  storage = browserStorage(),
) {
  storage.removeItem(key(orderId, userId));
}

export async function wholesaleUploadFileHash(file: Blob) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** 跨页后须重新选择同一批原文件；文件名相同不能证明正文没有改变。 */
export async function requireWholesaleUploadFiles(
  plan: WholesaleUploadPlan,
  files: File[],
) {
  const aligned = await alignFiles(plan, files);
  if (!aligned)
    throw new WholesaleOrderListUploadPending(new Error("请重新选择原附件。"));
  return aligned;
}

export async function matchesWholesaleUploadFiles(
  plan: WholesaleUploadPlan,
  files: File[],
) {
  return (await alignFiles(plan, files)) !== null;
}

async function alignFiles(plan: WholesaleUploadPlan, files: File[]) {
  if (plan.files.length !== files.length) return null;
  const candidates = await Promise.all(
    files.map(async (file) => ({
      file,
      sha256: await wholesaleUploadFileHash(file),
    })),
  );
  const aligned: File[] = [];
  for (const expected of plan.files) {
    // 文件选择器的顺序可能改变；按正文摘要配对，不能把甲文件写到乙文件的原路径。
    const index = candidates.findIndex(
      (item) =>
        item.file.name === expected.original_name &&
        item.file.size === expected.file_size_bytes &&
        item.sha256 === expected.sha256,
    );
    if (index < 0) return null;
    aligned.push(candidates.splice(index, 1)[0]!.file);
  }
  return aligned;
}

/** 准确路径之外，还要匹配名称、大小、类型与上传者，不能把别人的同名登记当成回执。 */
export function requireWholesaleUploadRegistration(
  plan: WholesaleUploadPlan,
  rows: WholesaleOrderListAttachment[],
) {
  if (rows.length !== plan.files.length)
    throw new WholesaleOrderListUploadPending(new Error("附件登记不完整。"));
  for (const expected of plan.files) {
    const row = rows.find(
      (item) => item.storage_path === expected.storage_path,
    );
    if (
      !row ||
      typeof row.id !== "string" ||
      !row.id ||
      row.bucket_name !== "wholesale-order-lists" ||
      row.order_id !== plan.orderId ||
      row.uploaded_by_user_id !== plan.userId ||
      row.original_name !== expected.original_name ||
      Number(row.file_size_bytes) !== expected.file_size_bytes ||
      row.mime_type !== expected.mime_type
    )
      throw new WholesaleOrderListUploadPending(
        new Error("附件登记与本次文件不一致。"),
      );
  }
}
