import assert from "node:assert/strict";
import test from "node:test";

import { decryptMailValue, encryptMailValue } from "../lib/mail/mail-security.ts";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("邮件密文可以往返读取普通文字", () => {
  const encrypted = encryptMailValue("PT5 Sales", KEY);
  assert.equal(decryptMailValue(encrypted, KEY), "PT5 Sales");
});

test("空签名保留四段密文格式并可正常读取", () => {
  const encrypted = encryptMailValue("", KEY);
  assert.equal(encrypted.split(":").length, 4);
  assert.equal(encrypted.endsWith(":"), true);
  assert.equal(decryptMailValue(encrypted, KEY), "");
});

test("缺少密文段时明确拒绝读取", () => {
  assert.throws(() => decryptMailValue("v1:invalid:invalid", KEY), /无法识别邮件密文格式/);
});

test("认证标签不匹配时不能返回伪造内容", () => {
  const encrypted = encryptMailValue("PT5 Sales", KEY);
  const parts = encrypted.split(":");
  parts[2] = `${parts[2].startsWith("A") ? "B" : "A"}${parts[2].slice(1)}`;
  assert.throws(() => decryptMailValue(parts.join(":"), KEY));
});

// NIST CAVS 14.0 gcmDecrypt256.rsp: IVlen=96, PTlen=0, AADlen=0, Taglen=128, Counts 0/1.
// Public standard vectors, independent of encryptMailValue; no production key is used.
const nistEnvelope = (iv, tag) => ["v1", Buffer.from(iv, "hex").toString("base64url"), Buffer.from(tag, "hex").toString("base64url"), ""].join(":");
test("NIST AES-256-GCM known valid empty plaintext decrypts", () => {
  assert.equal(decryptMailValue(nistEnvelope("58d2240f580a31c1d24948e9", "15e051a5e4a5f5da6cea92e2ebee5bac"), "f5a2b27c74355872eb3ef6c5feafaa740e6ae990d9d48c3bd9bb8235e589f010"), "");
});
test("NIST AES-256-GCM known FAIL vector is rejected", () => {
  assert.throws(() => decryptMailValue(nistEnvelope("51e43385bf533e168427e1ad", "38fe845c66e66bdd884c2aecafd280e6"), "e5a8123f2e2e007d4e379ba114a2fb66e6613f57c72d4e4f024964053028a831"));
});
for (const changed of ["key", "iv", "ciphertext"]) {
  test(`independent ${changed} mutation cannot authenticate`, () => {
    const parts = encryptMailValue("Fixed authenticated text", KEY).split(":");
    const key = changed === "key" ? `ff${KEY.slice(2)}` : KEY;
    if (changed !== "key") {
      const index = changed === "iv" ? 1 : 3;
      const bytes = Buffer.from(parts[index], "base64url"); bytes[0] ^= 1;
      parts[index] = bytes.toString("base64url");
    }
    assert.throws(() => decryptMailValue(parts.join(":"), key));
  });
}
