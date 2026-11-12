import assert from "node:assert/strict";
import test from "node:test";
import { isDeclaredLocalApi, readDeclaredApiPort } from "./local-api-config.mjs";
import { describeWindowsApiPort, parseExcludedTcpRanges } from "./windows-port-exclusions.mjs";

test("API 端口只从 [api] 段读取，不取 DB 或缺失配置", () => {
  assert.equal(readDeclaredApiPort("[db]\nport=54322\n[api]\nport = 48021 # local\n[auth]\nport=99\n"), "48021");
  for (const config of ["[db]\nport=54322\n", "[api]\nport=0\n", "[api]\nport=65536\n", "[api]\n# port=48021\n"]) assert.equal(readDeclaredApiPort(config), null);
});
test("声明端口改变后旧端口和其他原点拒绝，合法回环原点保留", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) assert.equal(isDeclaredLocalApi(`http://${host}:48021`, "48021"), true);
  for (const url of ["http://localhost:54321", "http://localhost:48022", "http://localhost.example:48021", "http://user:secret@localhost:48021", "https://localhost:48021", "http://localhost:48021/path", "http://localhost:48021?next=x"]) assert.equal(isDeclaredLocalApi(url, "48021"), false);
  assert.equal(isDeclaredLocalApi("http://localhost:48021", null), false);
});
test("中英文保留表按完整数字行解析，含管理员标记和边界", () => {
  const ranges = parseExcludedTcpRanges("Start Port End Port\r\n 54264 54363\r\n50000 50059 *\r\n端口说明 123\r\n9 2\r\n0 65536\r\n");
  assert.deepEqual(ranges, [{ start: 54264, end: 54363 }, { start: 50000, end: 50059 }]);
  for (const port of [54264, 54321, 54363]) assert.equal(describeWindowsApiPort(port, ranges).status, "error");
  assert.equal(describeWindowsApiPort(48021, ranges).status, "ok");
});
