/**
 * 写入型 RPC 必须返回业务回执。这个模块只做最基础的结构校验，
 * 每个业务调用仍要继续核对自己的订单编号、状态或版本号。
 */
export function requireMutationRecord(value: unknown, errorMessage: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(errorMessage);
  }
  return value as Record<string, unknown>;
}

export function requireMutationId(value: unknown, errorMessage: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorMessage);
  }
  return value;
}
