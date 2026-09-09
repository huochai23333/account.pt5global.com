import { createServer, type Server } from "node:http";

const summary = {
  feishuBound: true,
  feishuName: "测试飞书员工",
  connections: [{
    id: "11111111-1111-4111-8111-111111111111",
    maskedEmail: "sa*******@example.com",
    health: "active",
    monitorEnabled: true,
    watchExpiresAt: "2030-01-02T08:00:00.000Z",
    lastHealthyAt: "2030-01-01T08:00:00.000Z",
    lastError: null,
  }],
};

const rules = [{
  id: "22222222-2222-4222-8222-222222222222",
  name: "Fiverr",
  senderDomains: ["fiverr.com", "fvr.co"],
  subjectKeywords: [],
  keywordMode: "any",
  enabled: true,
}];

/** 本地回归只模拟插件边界，不连接真实 Gmail、飞书或云端服务。 */
export function startEmailConnectMockServer(port = 4110) {
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString("utf8");
    const pathname = new URL(request.url ?? "/", `http://127.0.0.1:${port}`).pathname;
    response.setHeader("content-type", "application/json");
    if (pathname.includes("/summary")) return response.end(JSON.stringify(summary));
    if (pathname === "/api/v1/rules/query") return response.end(JSON.stringify({ rules }));
    if (pathname === "/api/v1/admin/connections") {
      return response.end(JSON.stringify({ connections: [{
        externalUserId: "employee-1",
        displayName: "测试业务员",
        maskedEmail: "sa*******@example.com",
        health: "active",
        watchExpiresAt: "2030-01-02T08:00:00.000Z",
        lastHealthyAt: "2030-01-01T08:00:00.000Z",
        lastError: null,
      }] }));
    }
    if (pathname === "/api/v1/rules" && request.method === "PUT") {
      return response.end(JSON.stringify({ rules: JSON.parse(body).rules }));
    }
    if (pathname === "/api/v1/connect-sessions") {
      return response.end(JSON.stringify({ connectUrl: `http://127.0.0.1:${port}/connect`, expiresAt: "2030-01-01" }));
    }
    if (pathname.startsWith("/api/v1/connections/") && request.method === "DELETE") {
      return response.end(JSON.stringify({ disconnected: true }));
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not found" }));
  });
  return new Promise<Server>((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
