import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, createHash } from "node:crypto";
import {
  readWholesaleUploadPlan,
  saveWholesaleUploadPlan,
  clearWholesaleUploadPlan,
  wholesaleUploadFileHash,
  requireWholesaleUploadFiles,
  matchesWholesaleUploadFiles,
  requireWholesaleUploadRegistration,
  WholesaleOrderListUploadPending,
} from "../../lib/wholesale-order-list-upload-journal.ts";

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
async function fixture() {
  const orderId = randomUUID(),
    userId = randomUUID(),
    bytes = "name,qty\nlearning,2\n";
  const file = new File([bytes], "learning.csv", { type: "text/csv" });
  const plan = {
    orderId,
    userId,
    stage: "uploading",
    files: [
      {
        storage_path: `${orderId}/${userId}/${randomUUID()}-learning.csv`,
        original_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        sha256: await wholesaleUploadFileHash(file),
      },
    ],
  };
  return { plan, file, bytes, storage: memoryStorage() };
}

test("上传摘要使用实际正文，和独立Node摘要一致", async () => {
  const { plan, bytes } = await fixture();
  assert.equal(
    plan.files[0].sha256,
    createHash("sha256").update(bytes).digest("hex"),
  );
});

test("待核对范围按用户及订单隔离，写回只包含文件元数据", async () => {
  const { plan, storage } = await fixture();
  saveWholesaleUploadPlan(
    {
      ...plan,
      accessToken: "not-a-real-token",
      client: { private: "not-for-storage" },
    },
    storage,
  );
  assert.deepEqual(
    readWholesaleUploadPlan(plan.orderId, plan.userId, storage),
    plan,
  );
  assert.equal(
    readWholesaleUploadPlan(plan.orderId, randomUUID(), storage),
    null,
  );
  assert.equal(
    readWholesaleUploadPlan(randomUUID(), plan.userId, storage),
    null,
  );
  assert.ok(![...storage.values.values()][0].includes("not-a-real-token"));
});

test("跨用户路径和重复路径都不能成为可恢复的本批上传", async () => {
  const { plan, storage } = await fixture();
  const foreign = structuredClone(plan);
  foreign.files[0].storage_path = `${plan.orderId}/${randomUUID()}/file.csv`;
  assert.throws(() => saveWholesaleUploadPlan(foreign, storage));
  assert.throws(() =>
    saveWholesaleUploadPlan(
      { ...plan, files: [plan.files[0], plan.files[0]] },
      storage,
    ),
  );
  assert.equal(storage.values.size, 0);
});

test("对象范围不可包含子目录或父目录跳转", async () => {
  const { plan, storage } = await fixture();
  for (const name of ["nested/file.csv", "..", ".", ""]) {
    const changed = structuredClone(plan);
    changed.files[0].storage_path = `${plan.orderId}/${plan.userId}/${name}`;
    assert.throws(() => saveWholesaleUploadPlan(changed, storage));
  }
});

test("无效摘要、大小、文件类型和阶段均拒绝，不能自动丢弃旧记录", async () => {
  const { plan, storage } = await fixture();
  saveWholesaleUploadPlan(plan, storage);
  const key = [...storage.values.keys()][0],
    original = storage.getItem(key);
  for (const change of [
    { sha256: "" },
    { file_size_bytes: 0 },
    { file_size_bytes: 21 * 1024 * 1024 },
    { mime_type: "text/html" },
  ]) {
    const changed = structuredClone(plan);
    Object.assign(changed.files[0], change);
    assert.throws(() => saveWholesaleUploadPlan(changed, storage));
    assert.equal(storage.getItem(key), original);
  }
  storage.setItem(key, JSON.stringify({ ...plan, stage: "unknown-stage" }));
  assert.throws(() =>
    readWholesaleUploadPlan(plan.orderId, plan.userId, storage),
  );
  assert.ok(storage.getItem(key).includes("unknown-stage"));
});

test("损坏的标签页记录保留现场，不退回生成另一批路径", async () => {
  const { plan, storage } = await fixture();
  saveWholesaleUploadPlan(plan, storage);
  const key = [...storage.values.keys()][0];
  storage.setItem(key, "{incomplete");
  assert.throws(() =>
    readWholesaleUploadPlan(plan.orderId, plan.userId, storage),
  );
  assert.equal(storage.getItem(key), "{incomplete");
});

test("同名同大小但正文改变时拒绝沿用原路径", async () => {
  const { plan, file, storage, bytes } = await fixture();
  saveWholesaleUploadPlan(plan, storage);
  const changed = new File([bytes.replace("learning", "changed!")], file.name, {
    type: file.type,
  });
  assert.equal(changed.size, file.size);
  await assert.rejects(
    requireWholesaleUploadFiles(plan, [changed]),
    WholesaleOrderListUploadPending,
  );
  assert.equal(await matchesWholesaleUploadFiles(plan, [file]), true);
  assert.equal(await matchesWholesaleUploadFiles(plan, []), false);
  assert.equal(
    readWholesaleUploadPlan(plan.orderId, plan.userId, storage).files[0]
      .storage_path,
    plan.files[0].storage_path,
  );
});

test("读回登记必须属于准确订单、上传者、私有桶和原文件", async () => {
  const { plan } = await fixture(),
    file = plan.files[0];
  const row = {
    ...file,
    id: randomUUID(),
    order_id: plan.orderId,
    uploaded_by_user_id: plan.userId,
    bucket_name: "wholesale-order-lists",
    created_at: new Date().toISOString(),
  };
  assert.doesNotThrow(() => requireWholesaleUploadRegistration(plan, [row]));
  for (const change of [
    { order_id: randomUUID() },
    { uploaded_by_user_id: randomUUID() },
    { bucket_name: "other-bucket" },
    { original_name: "another.csv" },
    { mime_type: "text/html" },
    { file_size_bytes: 1 },
    { id: "" },
  ])
    assert.throws(
      () => requireWholesaleUploadRegistration(plan, [{ ...row, ...change }]),
      WholesaleOrderListUploadPending,
    );
  assert.throws(
    () => requireWholesaleUploadRegistration(plan, []),
    WholesaleOrderListUploadPending,
  );
});

test("完成核对只移除当前用户当前订单，保留其他未完成范围", async () => {
  const { plan, storage } = await fixture(),
    other = (await fixture()).plan;
  saveWholesaleUploadPlan(plan, storage);
  saveWholesaleUploadPlan(other, storage);
  clearWholesaleUploadPlan(plan.orderId, plan.userId, storage);
  assert.equal(
    readWholesaleUploadPlan(plan.orderId, plan.userId, storage),
    null,
  );
  assert.deepEqual(
    readWholesaleUploadPlan(other.orderId, other.userId, storage),
    other,
  );
});

test("浏览器存储不可用时直接拒绝，不能在没有核对范围时开始写入", async () => {
  const { plan } = await fixture(),
    failure = new Error("storage-unavailable");
  assert.throws(
    () =>
      readWholesaleUploadPlan(plan.orderId, plan.userId, {
        getItem() {
          throw failure;
        },
      }),
    failure,
  );
  assert.throws(
    () =>
      saveWholesaleUploadPlan(plan, {
        setItem() {
          throw failure;
        },
      }),
    failure,
  );
});

test("重选顺序改变时仍按原摘要配对，不把正文写入另一文件路径", async () => {
  const { plan, file } = await fixture(),
    second = new File(["second-row"], "second.csv", { type: "text/csv" });
  plan.files.push({
    storage_path: `${plan.orderId}/${plan.userId}/${randomUUID()}-second.csv`,
    original_name: second.name,
    mime_type: second.type,
    file_size_bytes: second.size,
    sha256: await wholesaleUploadFileHash(second),
  });
  const aligned = await requireWholesaleUploadFiles(plan, [second, file]);
  assert.equal(aligned[0], file);
  assert.equal(aligned[1], second);
});

test("待核对元数据同样受本批总大小限制", async () => {
  const { plan, storage } = await fixture(),
    original = plan.files[0];
  plan.files = Array.from({ length: 6 }, () => ({
    ...original,
    storage_path: `${plan.orderId}/${plan.userId}/${randomUUID()}.csv`,
    file_size_bytes: 20 * 1024 * 1024,
  }));
  assert.throws(() => saveWholesaleUploadPlan(plan, storage));
  assert.equal(storage.values.size, 0);
});
