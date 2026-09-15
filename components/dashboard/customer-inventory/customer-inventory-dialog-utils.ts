/**
 * 多个库存订单弹窗共用稳定的表单值读取规则。
 * 集中处理空白和数字转换，避免每个弹窗对“空备注”产生不同的数据。
 */
export function requiredValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function optionalValue(formData: FormData, key: string) {
  return requiredValue(formData, key) || null;
}

export function numberValue(formData: FormData, key: string) {
  return Number(formData.get(key));
}

export async function callRpc<T>(
  request: PromiseLike<{ data: T | null; error: unknown }>,
) {
  const { data, error } = await request;
  if (error) throw error;

  // 这些库存写入 RPC 都会返回被创建或修改的权威记录。没有回执时，即使网络层
  // 没有报错，也不能把本次操作当成已经完成。
  if (data === null || (Array.isArray(data) && data.length === 0)) {
    throw new Error("操作没有返回已保存的数据，请刷新后重试。");
  }

  return data;
}
