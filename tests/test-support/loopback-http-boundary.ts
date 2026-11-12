import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

/** 模拟服务也要收齐异步失败；Node 的 request 事件不会替我们等待 async 回调。 */
export async function startLoopbackBoundary(
  handler: (request: IncomingMessage, response: ServerResponse) => unknown,
  port: number,
) {
  const server = createServer((request, response) => {
    void Promise.resolve()
      .then(() => handler(request, response))
      .catch((error: unknown) => {
        if (response.destroyed || response.writableEnded) return;
        if (response.headersSent) {
          response.destroy();
          return;
        }
        // 错误回包只带固定标识，不回显输入正文、供应商令牌或内部异常。
        writeBoundaryJson(
          response,
          {
            error:
              error instanceof InvalidBoundaryJson
                ? "invalid-json"
                : "boundary-request-failed",
          },
          error instanceof InvalidBoundaryJson ? 400 : 500,
        );
      });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  return server;
}

class InvalidBoundaryJson extends Error {}

/** 空正文沿用原夹具的空对象；JSON 请求必须是对象，损坏输入由 HTTP 层结束。 */
export async function readBoundaryJson(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text || !request.headers["content-type"]?.includes("application/json"))
    return {};
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new InvalidBoundaryJson();
    return value as Record<string, unknown>;
  } catch {
    throw new InvalidBoundaryJson();
  }
}

export function writeBoundaryJson(
  response: ServerResponse,
  value: unknown,
  status = 200,
) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(value));
}

/** 先停止接收连接，再终止刻意悬挂的超时请求，避免回收等待供应商超时。 */
export async function closeLoopbackBoundary(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}
