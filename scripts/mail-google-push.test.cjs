/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
const { generateKeyPairSync, sign } = require("node:crypto");
const { before, after, test } = require("node:test");
const { OAuth2Client } = require("google-auth-library");
const ts = require("typescript");

const audience = "http://localhost/google-push-regression";
const serviceAccount = "pubsub@local-fixture.iam.gserviceaccount.com";
const originalEnvironment = {
  GOOGLE_PUBSUB_AUDIENCE: process.env.GOOGLE_PUBSUB_AUDIENCE,
  GOOGLE_PUBSUB_SERVICE_ACCOUNT: process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT,
};
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const otherKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
let server;
let verifyGooglePush;

before(async () => {
  server = http.createServer((request, response) => {
    assert.equal(request.url, "/certs");
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ local: keys.publicKey.export({ type: "spki", format: "pem" }) }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const endpoint = `http://127.0.0.1:${server.address().port}/certs`;
  // 只把证书下载切到本机；使用官方库原有的验签、受众、签发者和时效检查。
  class LocalCertificateClient extends OAuth2Client {
    constructor() { super({ endpoints: { oauth2FederatedSignonPemCertsUrl: endpoint, oauth2FederatedSignonJwkCertsUrl: endpoint } }); }
  }
  const unavailable = () => { throw new Error("身份校验回归不得读取数据库或业务配置"); };
  const dependencies = {
    "server-only": {},
    "google-auth-library": { OAuth2Client: LocalCertificateClient },
    "@/lib/supabase-admin-server": { getSupabaseServiceRoleClient: unavailable },
    "./mail-env": { getMailEnv: unavailable },
    "./mail-security": { createBlindIndex: unavailable },
  };
  const source = fs.readFileSync(path.join(__dirname, "../lib/mail/mail-google-push.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exported = {};
  vm.runInNewContext(compiled, {
    exports: exported, Buffer, Request, process, Date,
    require(name) { assert(Object.hasOwn(dependencies, name), "未声明的回归依赖"); return dependencies[name]; },
  }, { filename: "mail-google-push.ts", timeout: 2000 });
  verifyGooglePush = exported.verifyGooglePush;
  process.env.GOOGLE_PUBSUB_AUDIENCE = audience;
  process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT = serviceAccount;
});

after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function request(overrides = {}, signingKey = keys.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "local" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: "https://accounts.google.com", aud: audience,
    sub: "local-service", iat: now, exp: now + 1800, email: serviceAccount, email_verified: true, ...overrides })).toString("base64url");
  const input = `${header}.${claims}`;
  const token = `${input}.${sign("RSA-SHA256", Buffer.from(input), signingKey).toString("base64url")}`;
  const envelope = JSON.stringify({ message: { messageId: "local-notification", data: Buffer.from(JSON.stringify({
    emailAddress: "mailbox@example.invalid", historyId: "901",
  })).toString("base64") } });
  return verifyGooglePush(new Request(audience, { headers: { authorization: `Bearer ${token}` } }), envelope);
}

test("真实签名、受众、服务账号和明确已验证声明通过", async () => {
  const result = await request();
  assert.equal(result.messageId, "local-notification");
  assert.equal(result.notification.historyId, "901");
});
for (const [name, overrides, signingKey] of [
  ["错误签名", {}, otherKeys.privateKey],
  ["错误受众", { aud: "http://localhost/other" }],
  ["错误签发者", { iss: "https://issuer.example.invalid" }],
  ["过期令牌", { iat: 1, exp: 2 }],
  ["其他服务账号", { email: "other@example.invalid" }],
  ["未验证声明", { email_verified: false }],
  ["字符串 false", { email_verified: "false" }],
]) {
  test(`${name}不能成为可信推送`, async () => { await assert.rejects(() => request(overrides, signingKey)); });
}
test("缺少身份令牌时在下载证书前拒绝", async () => {
  await assert.rejects(() => verifyGooglePush(new Request(audience), "{}"), /身份令牌/);
});
