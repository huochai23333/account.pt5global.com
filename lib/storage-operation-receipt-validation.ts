type StorageExistenceResult = {
  data: boolean | null;
  error: unknown;
};

/**
 * 删除前先确认每个对象都真实存在且当前账号能够读取。
 * 这一步让后续的 404 具有明确含义，也能在请求目标已经不存在时阻止“删除成功”。
 */
export async function confirmStoragePathsPresent(
  storagePaths: string[],
  checkExistence: (storagePath: string) => Promise<StorageExistenceResult>,
  confirmationMessage: string,
) {
  for (const storagePath of storagePaths) {
    const existence = await checkExistence(storagePath);
    if (existence.data !== true || existence.error) {
      throw existence.error ?? new Error(confirmationMessage);
    }
  }
}

/**
 * 上传回执必须指向本次请求的准确对象路径；HTTP 状态或空对象都不是业务完成凭证。
 */
export function requireStorageUploadReceipt(
  value: unknown,
  expectedPath: string,
  errorMessage: string,
) {
  if (!isRecord(value) || value.path !== expectedPath) {
    throw new Error(errorMessage);
  }

  return value;
}

/**
 * Storage 删除接口可能返回空数组，但必须至少返回数组类型，证明服务端按删除协议响应。
 * 真正的删除完成仍由后续逐项“不存在”检查决定。
 */
export function requireStorageRemoveDispatchReceipt(
  value: unknown,
  errorMessage: string,
) {
  if (!Array.isArray(value)) throw new Error(errorMessage);
  return value;
}

/**
 * 文件对象上传完成后，数据库登记也必须逐条返回权威记录。
 * 除数量外还核对父记录、对象路径和数据库编号，避免空数组或错单数据被当成完成。
 */
export function requireRegisteredStorageRows<T>(
  value: unknown,
  options: {
    errorMessage: string;
    expectedParentId: string;
    expectedPaths: string[];
    parentField: string;
    pathField: string;
  },
) {
  if (!Array.isArray(value) || value.length !== options.expectedPaths.length) {
    throw new Error(options.errorMessage);
  }

  const expectedPaths = new Set(options.expectedPaths);
  const returnedPaths = new Set<string>();

  for (const item of value) {
    if (
      !isRecord(item)
      || typeof item.id !== "string"
      || item.id.trim().length === 0
      || item[options.parentField] !== options.expectedParentId
      || typeof item[options.pathField] !== "string"
      || !expectedPaths.has(item[options.pathField] as string)
    ) {
      throw new Error(options.errorMessage);
    }
    returnedPaths.add(item[options.pathField] as string);
  }

  if (returnedPaths.size !== expectedPaths.size) {
    throw new Error(options.errorMessage);
  }

  return value as T[];
}

/**
 * 删除请求结束后逐个核对对象是否仍存在。Supabase Storage 的 exists() 会把
 * 明确的 400/404“不存在”包装为 data=false 加 StorageApiError，因此这里只接受
 * 无错误的 false，或已经完成删除前可见性验证后的标准“不存在”错误。
 */
export async function confirmStoragePathsMissing(
  storagePaths: string[],
  checkExistence: (storagePath: string) => Promise<StorageExistenceResult>,
  confirmationMessage: string,
) {
  for (const storagePath of storagePaths) {
    const existence = await checkExistence(storagePath);
    if (existence.data !== false || !isConfirmedMissingError(existence.error)) {
      throw existence.error ?? new Error(confirmationMessage);
    }
  }
}

function isConfirmedMissingError(error: unknown) {
  if (error === null || error === undefined) return true;
  if (!isRecord(error)) return false;

  return (
    error.name === "StorageApiError"
    && (error.status === 400 || error.status === 404)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
