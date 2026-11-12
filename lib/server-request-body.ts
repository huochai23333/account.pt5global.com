/**
 * 请求体超出接口允许大小时抛出这个错误，路由可以据此返回 413。
 */
export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("request body too large");
    this.name = "RequestBodyTooLargeError";
  }
}

/**
 * 按字节读取 JSON 请求体，而不是先调用 request.json() 把全部内容放进内存。
 * 这样即使请求方伪造 Content-Length，也会在实际读取超过限制时立刻停止。
 */
export async function readLimitedJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  if (!request.body) {
    throw new SyntaxError("missing request body");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      receivedBytes += value.byteLength;

      if (receivedBytes > maxBytes) {
        // 取消底层读取可能失败或延迟；立即保留超限错误供路由返回 413。
        void reader.cancel("request body too large").catch(() => {});
        throw new RequestBodyTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(receivedBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(body));
}
