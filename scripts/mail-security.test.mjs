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
