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
