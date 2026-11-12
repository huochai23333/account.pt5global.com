import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";
import { createOwnedUserMediaCase } from "../../tests/test-support/user-media-owned-case.ts";

const user = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  asset = "b1000000-0000-4000-8000-000000000001";
const object = "b2000000-0000-4000-8000-000000000001",
  review = "b3000000-0000-4000-8000-000000000001";
const name = "user-media-receipt-11111111-1111-4111-8111-111111111111.png";
const path = `${user}/image/22222222-2222-4222-8222-222222222222-${name}`,
  bytes = Buffer.from("synthetic-png");
const empty = () => ({ assets: [], objects: [], reviews: [] });
function initial() {
  return {
    assets: [
      {
        id: asset,
        user_id: user,
        bucket_name: "user-media",
        storage_path: path,
        original_name: name,
        kind: "image",
        mime_type: "image/png",
        file_size_bytes: bytes.length,
        status: "pending",
        _xmin: "100",
      },
    ],
    objects: [
      {
        id: object,
        bucket_id: "user-media",
        name: path,
        version: "v1",
        metadata: { size: bytes.length },
      },
    ],
    reviews: [
      {
        id: review,
        asset_id: asset,
        status: "completed",
        decision: "manual_review",
        completed_at: "2026-11-11T00:00:00Z",
        _xmin: "101",
      },
    ],
  };
}
function harness(snapshot = initial()) {
  const h = {
    snapshot,
    physical: snapshot.objects.length > 0,
    content: bytes,
    calls: [],
    modes: {},
    scopes: [],
  };
  h.fixture = createOwnedUserMediaCase(
    {
      read: async (scope) => {
        h.scopes.push(scope);
        h.calls.push("read");
        return structuredClone(h.snapshot);
      },
      present: async () => {
        h.calls.push("present");
        if (h.modes.listError) throw Error("listing failed");
        return h.physical;
      },
      download: async () => {
        h.calls.push("download");
        return h.content;
      },
      remove: async () => {
        h.calls.push("remove");
        if (h.modes.removeError) throw Error("storage remove failed");
        if (!h.modes.fakeRemove) {
          h.snapshot.objects = [];
          h.physical = false;
        }
        if (h.modes.lostRemove) throw Error("storage reply lost");
      },
      deleteRows: async () => {
        h.calls.push("deleteRows");
        if (h.modes.zeroRows) return [];
        const ids = h.snapshot.assets.map((a) => a.id);
        h.snapshot.assets = [];
        h.snapshot.reviews = [];
        if (h.modes.lostRows) throw Error("database reply lost");
        return ids;
      },
    },
    user,
    name,
    bytes,
  );
  return h;
}

// 只有显式内存端口，不连接账号、Docker或Storage；真实SDK/SQL链路在专属项目另验。
test("非法编号、文件意图或空内容在任何能力调用前拒绝", () => {
  for (const [id, file, content] of [
    ["bad", name, bytes],
    [user, "retry.png", bytes],
    [
      user,
      "user-media-receipt-------------------------------------.png",
      bytes,
    ],
    [user, name, Buffer.alloc(0)],
  ])
    assert.throws(
      () => createOwnedUserMediaCase({}, id, file, content),
      /identity_invalid/,
    );
});
test("上传须有行/对象/审核终态/内容SHA，并返回防修改凭证", async () => {
  const h = harness(),
    receipt = await h.fixture.uploaded();
  receipt.user_id = "foreign";
  h.fixture.evidence().last.assets[0].status = "foreign";
  await h.fixture.unchanged();
  assert(h.scopes.at(-1).assetIds.includes(asset));
  assert(h.scopes.at(-1).objectIds.includes(object));
});
test("队列中、处理中、评估失败或空终态凭证都不能算完整上传核对", async () => {
  for (const [state, expected] of [
    ["queued", /not_terminal/],
    ["processing", /not_terminal/],
    ["failed", /review_failed/],
  ]) {
    const h = harness();
    h.snapshot.reviews[0].status = state;
    await assert.rejects(h.fixture.uploaded(), expected);
    assert(!h.calls.includes("remove"));
  }
  const h = harness();
  h.snapshot.reviews[0].completed_at = "";
  await assert.rejects(h.fixture.uploaded(), /receipt_invalid/);
});
test("错误所有者、重复行、错路径、错误大小和缺审核记录均不能删除", async () => {
  for (const change of [
    (p) => (p.assets[0].user_id = "foreign"),
    (p) => p.assets.push(p.assets[0]),
    (p) => (p.objects[0].name = "foreign/image/x"),
    (p) => (p.objects[0].metadata.size = 999),
    (p) => (p.reviews = []),
  ]) {
    const h = harness();
    change(h.snapshot);
    await assert.rejects(h.fixture.cleanup());
    assert(!h.calls.includes("remove"));
  }
});
test("目录读取失败、元数据存在但物理缺失或内容SHA错误不接受", async () => {
  for (const change of [
    (h) => (h.modes.listError = true),
    (h) => (h.physical = false),
    (h) => (h.content = Buffer.from("wrong")),
  ]) {
    const h = harness();
    change(h);
    await assert.rejects(h.fixture.uploaded());
    assert(!h.calls.includes("remove"));
  }
});
test("同值新资产版本、对象内容版本或审核版本变化均拒绝清理", async () => {
  for (const change of [
    (p) => (p.assets[0]._xmin = "102"),
    (p) => (p.objects[0].version = "v2"),
    (p) => (p.reviews[0]._xmin = "102"),
  ]) {
    const h = harness();
    await h.fixture.uploaded();
    change(h.snapshot);
    await assert.rejects(h.fixture.cleanup(), /cleanup_changed/);
    assert(!h.calls.includes("remove"));
  }
});
test("第一次读回前中断仍按独占意图完整回收，不能依赖receipt非空", async () => {
  const h = harness();
  assert.deepEqual(await h.fixture.cleanup(), { assets: 1, objects: 1 });
  assert(h.fixture.evidence().cleaned);
  assert.deepEqual(h.snapshot, empty());
});
test("登记前留下的孤立对象也须核对SHA再精确删除", async () => {
  const h = harness({ ...initial(), assets: [], reviews: [] });
  assert.deepEqual(await h.fixture.cleanup(), { assets: 0, objects: 1 });
  assert.equal(h.physical, false);
});
test("页面真实删除后须独立查行/审核/对象和成功LIST为空", async () => {
  const h = harness();
  await h.fixture.uploaded();
  h.snapshot = empty();
  h.physical = false;
  await h.fixture.missing();
  assert.deepEqual(await h.fixture.cleanup(), { assets: 0, objects: 0 });
});
test("伪造Storage删除或API失败不能继续删数据库行", async () => {
  for (const mode of ["fakeRemove", "removeError"]) {
    const h = harness();
    h.modes[mode] = true;
    await assert.rejects(
      h.fixture.cleanup(),
      /remove_unconfirmed|remove failed/,
    );
    assert(!h.calls.includes("deleteRows"));
    assert.equal(h.snapshot.assets.length, 1);
    await assert.rejects(h.fixture.cleanup(), /outcome_unknown/);
  }
});
test("Storage提交回包丢失仍保留未知，资产记录不能被继续删", async () => {
  const h = harness();
  h.modes.lostRemove = true;
  await assert.rejects(h.fixture.cleanup(), /reply lost/);
  assert.equal(h.snapshot.objects.length, 0);
  assert.equal(h.snapshot.assets.length, 1);
  assert(!h.calls.includes("deleteRows"));
  await assert.rejects(h.fixture.cleanup(), /outcome_unknown/);
});
test("数据库0行和已提交丢回包都不能假报清理成功", async () => {
  for (const mode of ["zeroRows", "lostRows"]) {
    const h = harness();
    h.modes[mode] = true;
    await assert.rejects(h.fixture.cleanup(), /delete_unconfirmed|reply lost/);
    assert.equal(h.fixture.evidence().cleaned, false);
    await assert.rejects(h.fixture.cleanup(), /outcome_unknown/);
    assert.equal(h.snapshot.assets.length, mode === "zeroRows" ? 1 : 0);
  }
});

// 只抽取原页面的收尾函数，不加载认证import；必须用同一实现验证正文/收尾错误保留。
function pageFinalizer() {
  const file = "tests/e2e/user-media-operation-receipts.spec.ts",
    source = fs.readFileSync(file, "utf8");
  const root = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const fn = root.statements.find(
    (n) =>
      ts.isFunctionDeclaration(n) && n.name?.text === "finalizeOwnedMediaCase",
  );
  assert(fn);
  const code = ts.transpileModule(fn.getText(root), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(
    "cleanupFixtureResources",
    code + ";return finalizeOwnedMediaCase;",
  )(cleanupFixtureResources);
}
test("正文/清理/附件同时失败全部保留，关闭成功后才调用回收", async () => {
  const body = Error("body"),
    cleanup = Error("cleanup"),
    attach = Error("attach"),
    calls = [];
  await assert.rejects(
    pageFinalizer()(
      {
        isClosed: () => false,
        unrouteAll: async () => {
          calls.push("drain");
        },
        close: async () => {
          calls.push("close");
        },
      },
      {
        cleanup: async () => {
          calls.push("cleanup");
          throw cleanup;
        },
        evidence: () => ({ stage: "unknown" }),
      },
      { error: body },
      async () => {
        calls.push("attach");
        throw attach;
      },
    ),
    (e) =>
      e instanceof AggregateError &&
      e.errors.length === 3 &&
      e.errors[0] === body &&
      e.errors[1] === cleanup &&
      e.errors[2] === attach,
  );
  assert.deepEqual(calls, ["drain", "close", "cleanup", "attach"]);
});
test("关闭失败仍保留附件与正文错误，但不冒险调用数据删除", async () => {
  const body = Error("body"),
    close = Error("close"),
    calls = [];
  await assert.rejects(
    pageFinalizer()(
      {
        isClosed: () => false,
        unrouteAll: async () => {},
        close: async () => {
          throw close;
        },
      },
      {
        cleanup: async () => {
          calls.push("unsafe cleanup");
        },
        evidence: () => ({}),
      },
      { error: body },
      async (payload) => {
        calls.push(JSON.parse(payload).pageClosed);
      },
    ),
    (e) =>
      e instanceof AggregateError &&
      e.errors.length === 2 &&
      e.errors[0] === body &&
      e.errors[1] === close,
  );
  assert.deepEqual(calls, [false]);
});
