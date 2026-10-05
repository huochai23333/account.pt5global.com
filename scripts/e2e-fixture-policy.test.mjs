import assert from "node:assert/strict";
import test from "node:test";
import { requireDisposableFixture } from "../tests/test-support/disposable-fixture.ts";

const valid = { baseURL: "http://127.0.0.1:3000", supabaseURL: "http://localhost:54321", mode: "disposable" };
test("explicit disposable local endpoints pass the admission guard", () => {
  assert.doesNotThrow(() => requireDisposableFixture(valid));
});
for (const mode of [undefined, "", "shared", "Disposable"]) {
  test(`isolated wrong fixture mode ${JSON.stringify(mode)} rejects`, () => {
    assert.throws(() => requireDisposableFixture({ ...valid, mode }), /PT5_E2E_FIXTURE_MODE/);
  });
}
for (const field of ["baseURL", "supabaseURL"]) {
  for (const endpoint of [undefined, "http://localhost.example.test", "https://remote.example.test", "file:///localhost", "http://user:synthetic@localhost"]) {
    test(`isolated invalid ${field} ${JSON.stringify(endpoint)} rejects`, () => {
      assert.throws(() => requireDisposableFixture({ ...valid, [field]: endpoint }), /fixture endpoint/);
    });
  }
}
test("IPv6 loopback is accepted only with the explicit fixture declaration", () => {
  assert.doesNotThrow(() => requireDisposableFixture({ ...valid, baseURL: "http://[::1]:3000", supabaseURL: "http://[::1]:54321" }));
});
