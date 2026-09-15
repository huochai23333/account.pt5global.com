import assert from "node:assert/strict";
import test from "node:test";

import {
  requireAuthRequestAccepted,
  requireAuthUserReceipt,
  requireSignedOutSessionReceipt,
} from "../lib/auth-operation-receipts.ts";

const errorMessage = "账号操作没有确认完成";

test("邮件请求只接受对象结构，不把它解释成已经投递", () => {
  assert.deepEqual(requireAuthRequestAccepted({}, errorMessage), {});
  assert.throws(
    () => requireAuthRequestAccepted(null, errorMessage),
    new RegExp(errorMessage),
  );
});

test("用户回执必须包含用户编号并匹配预期邮箱", () => {
  const receipt = requireAuthUserReceipt(
    { user: { id: "user-1", email: "USER@example.com" } },
    { errorMessage, expectedEmail: "user@example.com" },
  );
  assert.equal(receipt.userId, "user-1");

  assert.throws(
    () => requireAuthUserReceipt({ user: { email: "user@example.com" } }, { errorMessage }),
    new RegExp(errorMessage),
  );
  assert.throws(
    () => requireAuthUserReceipt(
      { user: { id: "user-1", email: "another@example.com" } },
      { errorMessage, expectedEmail: "user@example.com" },
    ),
    new RegExp(errorMessage),
  );
});

test("退出回执只有明确空会话时通过", () => {
  assert.doesNotThrow(() => requireSignedOutSessionReceipt({ session: null }, errorMessage));
  assert.throws(
    () => requireSignedOutSessionReceipt({ session: { user: { id: "user-1" } } }, errorMessage),
    new RegExp(errorMessage),
  );
  assert.throws(
    () => requireSignedOutSessionReceipt({}, errorMessage),
    new RegExp(errorMessage),
  );
});
