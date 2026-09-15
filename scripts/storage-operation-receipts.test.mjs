import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmStoragePathsMissing,
  confirmStoragePathsPresent,
  requireRegisteredStorageRows,
  requireStorageRemoveDispatchReceipt,
  requireStorageUploadReceipt,
} from "../lib/storage-operation-receipt-validation.ts";

const confirmationMessage = "没有确认文件处理完成";

test("上传回执必须包含本次请求的准确对象路径", () => {
  assert.equal(
    requireStorageUploadReceipt(
      { id: "object-1", path: "orders/order-1/a.pdf" },
      "orders/order-1/a.pdf",
      confirmationMessage,
    ).path,
    "orders/order-1/a.pdf",
  );

  assert.throws(
    () => requireStorageUploadReceipt(null, "orders/order-1/a.pdf", confirmationMessage),
    new RegExp(confirmationMessage),
  );
  assert.throws(
    () => requireStorageUploadReceipt(
      { path: "orders/order-2/a.pdf" },
      "orders/order-1/a.pdf",
      confirmationMessage,
    ),
    new RegExp(confirmationMessage),
  );
});

test("数据库登记回执必须逐条匹配父记录、对象路径和记录编号", () => {
  const rows = [
    { id: "attachment-1", order_id: "order-1", storage_path: "orders/order-1/a.pdf" },
    { id: "attachment-2", order_id: "order-1", storage_path: "orders/order-1/b.pdf" },
  ];
  const options = {
    errorMessage: confirmationMessage,
    expectedParentId: "order-1",
    expectedPaths: ["orders/order-1/a.pdf", "orders/order-1/b.pdf"],
    parentField: "order_id",
    pathField: "storage_path",
  };

  assert.deepEqual(requireRegisteredStorageRows(rows, options), rows);
  assert.throws(
    () => requireRegisteredStorageRows([], options),
    new RegExp(confirmationMessage),
  );
  assert.throws(
    () => requireRegisteredStorageRows([
      rows[0],
      { ...rows[1], storage_path: rows[0].storage_path },
    ], options),
    new RegExp(confirmationMessage),
  );
  assert.throws(
    () => requireRegisteredStorageRows([
      rows[0],
      { ...rows[1], order_id: "order-2" },
    ], options),
    new RegExp(confirmationMessage),
  );
});

test("删除派发必须收到数组结构的服务端回执", () => {
  assert.deepEqual(requireStorageRemoveDispatchReceipt([], confirmationMessage), []);
  assert.throws(
    () => requireStorageRemoveDispatchReceipt(null, confirmationMessage),
    new RegExp(confirmationMessage),
  );
});

test("删除前必须逐个确认对象存在且可读", async () => {
  await confirmStoragePathsPresent(
    ["tasks/a.pdf", "tasks/b.pdf"],
    async () => ({ data: true, error: null }),
    confirmationMessage,
  );

  await assert.rejects(
    confirmStoragePathsPresent(
      ["tasks/a.pdf"],
      async () => ({ data: false, error: null }),
      confirmationMessage,
    ),
    new RegExp(confirmationMessage),
  );
});

test("删除后只有逐个确认对象不存在才算完成", async () => {
  const calls = [];
  await confirmStoragePathsMissing(
    ["tasks/a.pdf", "tasks/a.pdf", "tasks/b.pdf"],
    async (path) => {
      calls.push(path);
      return { data: false, error: null };
    },
    confirmationMessage,
  );

  assert.deepEqual(calls, ["tasks/a.pdf", "tasks/a.pdf", "tasks/b.pdf"]);
});

test("对象仍存在和无法确认的查询都必须失败", async () => {
  await assert.rejects(
    confirmStoragePathsMissing(
      ["tasks/a.pdf"],
      async () => ({ data: true, error: null }),
      confirmationMessage,
    ),
    new RegExp(confirmationMessage),
  );

  await assert.rejects(
    confirmStoragePathsMissing(
      ["tasks/a.pdf"],
      async () => ({ data: false, error: { status: 500 } }),
      confirmationMessage,
    ),
  );

  // 普通对象伪装成 404 仍然不能通过；只有 Storage SDK 的标准错误结构才可作为不存在凭证。
  await assert.rejects(
    confirmStoragePathsMissing(
      ["tasks/a.pdf"],
      async () => ({ data: false, error: { status: 404 } }),
      confirmationMessage,
    ),
  );

  await confirmStoragePathsMissing(
    ["tasks/a.pdf"],
    async () => ({
      data: false,
      error: { name: "StorageApiError", status: 404 },
    }),
    confirmationMessage,
  );
});
