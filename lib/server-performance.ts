import { cache } from "react";

// 每次服务端渲染生成独立编号；不包含用户编号、邮箱、Cookie 或查询参数。
const getPerformanceRequestId = cache(() => crypto.randomUUID());

/** 用固定阶段名记录部署端等待，默认关闭；开启后仅输出耗时和完成情况。 */
export async function measureServerStage<T>(stage: string, task: () => PromiseLike<T>): Promise<T> {
  if (typeof window !== "undefined" || process.env.PT5_PERFORMANCE_LOG !== "1") return await task();
  const requestId = getPerformanceRequestId();
  const started = performance.now();
  let outcome = "completed";
  try { return await task(); }
  catch (error) { outcome = "failed"; throw error; }
  finally {
    console.info(JSON.stringify({ event: "pt5.performance", requestId, stage,
      durationMs: Math.round((performance.now() - started) * 10) / 10, outcome }));
  }
}

/** 只接受数据库对象路径；自由文本、记录编号和请求内容永远不写入日志。 */
export function getSupabasePerformanceStage(input: RequestInfo | URL) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const path = url.pathname;
  if (path === "/auth/v1/user") return "database.auth-user";
  const match = path.match(/^\/rest\/v1\/(?:rpc\/)?([a-z_]+)$/);
  return match ? `database.${match[1]}` : "database.other";
}

export const timedSupabaseFetch: typeof fetch = (input, init) =>
  measureServerStage(getSupabasePerformanceStage(input), () => fetch(input, init));
