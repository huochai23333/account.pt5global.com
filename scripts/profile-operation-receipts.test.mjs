import assert from "node:assert/strict";
import test from "node:test";

import {
  requireProfileRequestReceipt,
  requireProfileWriteReceipt,
} from "../lib/profile-operation-receipts.ts";

test("资料更新影响 0 行时必须失败", () => {
  assert.throws(
    () => requireProfileWriteReceipt(null, { city: "上海", userId: "user-1" }),
    /没有返回可确认的保存结果/,
  );
});

test("资料更新返回其它用户或旧字段时必须失败", () => {
  assert.throws(
    () =>
      requireProfileWriteReceipt(
        { city: "杭州", name: "旧姓名", user_id: "user-2" },
        { city: "上海", name: "新姓名", userId: "user-1" },
      ),
    /与提交内容不一致/,
  );
});

test("资料申请必须返回待审核状态和同一提交内容", () => {
  assert.doesNotThrow(() =>
    requireProfileRequestReceipt(
      {
        id: "request-1",
        requested_city: "上海",
        requested_name: "新姓名",
        status: "pending",
      },
      { city: "上海", name: "新姓名", status: "pending" },
    ),
  );
});

test("管理员审核返回其它申请时必须失败", () => {
  assert.throws(
    () =>
      requireProfileRequestReceipt(
        { id: "request-2", status: "approved" },
        { requestId: "request-1", status: "approved" },
      ),
    /与当前操作不一致/,
  );
});

// 每次只改变一个字段，避免多个错误同时存在时掩盖缺失的身份/字段校验。
const submittedProfile = { city: "Shanghai", name: "Alice", userId: "user-1" };
const savedProfile = { city: "Shanghai", name: "Alice", user_id: "user-1" };
test("matching profile identity and submitted fields is a positive control", () => {
  assert.doesNotThrow(() => requireProfileWriteReceipt(savedProfile, submittedProfile));
});
for (const [field, wrong] of [["user_id", "user-2"], ["city", "Beijing"], ["name", "Bob"]]) {
  test(`profile receipt rejects an independently wrong ${field}`, () => {
    assert.throws(() => requireProfileWriteReceipt({ ...savedProfile, [field]: wrong }, submittedProfile));
  });
}

const submittedRequest = { city: "Shanghai", name: "Alice", requestId: "request-1", status: "pending" };
const savedRequest = { id: "request-1", requested_city: "Shanghai", requested_name: "Alice", status: "pending" };
test("matching request identity, status and submitted fields is a positive control", () => {
  assert.doesNotThrow(() => requireProfileRequestReceipt(savedRequest, submittedRequest));
});
for (const [field, wrong] of [["id", "request-2"], ["status", "approved"], ["requested_city", "Beijing"], ["requested_name", "Bob"]]) {
  test(`profile request rejects an independently wrong ${field}`, () => {
    assert.throws(() => requireProfileRequestReceipt({ ...savedRequest, [field]: wrong }, submittedRequest));
  });
}
