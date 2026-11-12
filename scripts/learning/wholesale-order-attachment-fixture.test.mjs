import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";
import {
  actor,
  capabilityFile,
  harness,
  load,
} from "../../tests/test-support/wholesale-order-attachment-model.mjs";

test("两附件登记与对象凭证齐全后，实际删除代码清空，父行已删仍可重复收尾", async () => {
  const h = harness();
  await h.upload();
  await h.upload(1);
  h.register();
  h.fixture.verifyPresent();
  await h.fixture.verifyBytes("b.csv");
  await h.fixture.cleanup();
  h.fixture.requireCleared();
  assert.equal(h.order.dispatchPending, 0);
  assert.equal(h.state.apiCalls.length, 4);
  h.graph.order = null;
  await h.fixture.cleanup();
  assert.equal(h.state.apiCalls.length, 4);
});

test("登记不完整不取得删除授权；明确未转发才回收已确认孤立对象", async () => {
  const unknown = harness();
  await unknown.upload();
  await unknown.upload(1);
  unknown.register("partial");
  assert.throws(
    () => unknown.fixture.confirmRegistered(),
    /receipt_unconfirmed/,
  );
  await assert.rejects(unknown.fixture.cleanup(), /registration_unconfirmed/);
  assert.equal(unknown.state.apiCalls.length, 0);
  assert.equal(unknown.state.objects.length, 2);
  const known = harness();
  await known.upload();
  await known.upload(1);
  known.register("not-forwarded");
  await known.fixture.confirmUnregisteredObjects();
  assert.equal(known.graph.attachments.length, 0);
  await known.fixture.cleanup();
  assert.equal(known.state.objects.length, 0);
  assert(known.state.apiCalls.every((call) => call[0] === "remove"));
});

test("外单路径、重复上传和未声明删除在API之前拒绝", async () => {
  const h = harness();
  assert.throws(
    () =>
      h.fixture.beginUpload(`${randomUUID()}/${actor}/${randomUUID()}-a.csv`),
    /outside_owner/,
  );
  await h.upload();
  assert.throws(
    () =>
      h.fixture.beginUpload(
        `${h.graph.order.id}/${actor}/${randomUUID()}-a.csv`,
      ),
    /upload_reused/,
  );
  assert.throws(
    () => h.fixture.beginRemovalTransport(["foreign"]),
    /outside_manifest/,
  );
  assert.equal(h.state.apiCalls.length, 0);
});

test("字节哈希、对象拥有者和版本不符均保留待决，不因2xx允许收尾", async () => {
  for (const change of [
    (_row, name, h) =>
      h.state.bytes.set(name, Buffer.alloc(h.files[0].buffer.length, 120)),
    (row) => {
      row.owner_id = randomUUID();
    },
    (row) => {
      row.version = "";
    },
    (row) => {
      row.metadata.mimetype = "wrong";
    },
    (row) => {
      row.metadata.size++;
    },
  ]) {
    const h = harness();
    await assert.rejects(h.upload(0, (row, name) => change(row, name, h)));
    assert.equal(h.order.dispatchPending, 1);
    await assert.rejects(h.fixture.cleanup(), /dispatch_unconfirmed/);
    assert.equal(h.state.apiCalls.length, 0);
  }
});

test("登记行xmin、对象version、父行或额外孤立对象变化后拒绝删除", async () => {
  for (const change of [
    (h) => {
      h.graph.attachments[0]._xmin = "124";
    },
    (h) => {
      h.state.objects[0].version = randomUUID();
    },
    (h) => {
      h.graph.order._xmin = "999";
    },
    (h) => {
      h.state.objects.push({ id: randomUUID(), name: "foreign" });
    },
  ]) {
    const h = harness();
    await h.upload();
    await h.upload(1);
    h.register();
    change(h);
    await assert.rejects(h.fixture.cleanup());
    assert.equal(h.state.apiCalls.length, 0);
  }
});

test("删除零行或对象未消失不能清父记录，失败保持待决", async () => {
  for (const flag of ["zeroDelete", "keepObject"]) {
    const h = harness();
    await h.upload();
    await h.upload(1);
    h.register();
    h.state[flag] = true;
    await assert.rejects(h.fixture.cleanup());
    assert.equal(h.order.dispatchPending, 1);
    assert(h.graph.attachments.length > 0);
    await assert.rejects(h.fixture.cleanup(), /dispatch_unconfirmed/);
  }
});

test("未登记的UI删除请求不取得能力；正常UI删除由独立快照收尾", async () => {
  const h = harness();
  await h.upload();
  await h.upload(1);
  h.register();
  const row = h.graph.attachments.find((row) => row.original_name === "a.csv");
  assert.throws(
    () => h.fixture.beginRemovalTransport([row.storage_path]),
    /outside_manifest/,
  );
  h.fixture.beginRemoval("a.csv");
  h.fixture.beginRemovalTransport([row.storage_path]);
  h.state.objects = h.state.objects.filter(
    (object) => object.name !== row.storage_path,
  );
  h.graph.attachments = h.graph.attachments.filter(
    (item) => item.id !== row.id,
  );
  h.fixture.finishRemovalTransport();
  h.fixture.confirmRemoved("a.csv");
  await h.fixture.cleanup();
  h.fixture.requireCleared();
});

test("原会话能力仅在本地且Auth确认同一用户后可用，换令牌重新确认", async () => {
  const state = { checks: 0, actors: 0, user: actor, tokens: [] };
  const api = load(capabilityFile, {
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:48021" } },
    "./local-supabase": {
      runLocalSupabaseSql: () => {
        state.checks++;
      },
    },
    "@supabase/supabase-js": {
      createClient: (_url, _key, options) => ({
        auth: {
          getUser: async (token) => {
            state.actors++;
            state.tokens.push(token);
            assert.equal(options.auth.persistSession, false);
            return { data: { user: { id: state.user } }, error: null };
          },
        },
      }),
    },
  });
  const cap = api.createAttachmentCapability(actor);
  await assert.rejects(cap.client(), /not_captured/);
  const request = (token, origin = "http://127.0.0.1:48021") => ({
    url: () => origin + "/storage/v1/object/x",
    headers: () => ({
      authorization: `Bearer ${token}`,
      apikey: "synthetic-local-only",
    }),
  });
  assert.throws(
    () => cap.capture(request("a", "https://foreign.invalid")),
    /foreign_origin/,
  );
  cap.capture(request("a"));
  await cap.client();
  await cap.client();
  assert.equal(state.actors, 1);
  cap.capture(request("b"));
  await cap.client();
  assert.equal(state.actors, 2);
  cap.capture(request("c"));
  state.user = randomUUID();
  await assert.rejects(cap.client(), /actor_unconfirmed/);
  assert.deepEqual(Object.keys(cap).sort(), ["capture", "client"]);
});

test("Storage目录读取限定完整订单前缀，拒绝SQL拼接，资产固定为已验证工作簿", () => {
  const inputs = [],
    api = load("tests/e2e/helpers/wholesale-fee-database.ts", {
      "./local-supabase": {
        runLocalSupabaseSql: (input) => {
          inputs.push(input);
          return "[]";
        },
      },
    });
  api.readWholesaleOrderAttachmentObjects(
    "c2000000-0000-4000-8000-000000000002",
  );
  assert.match(inputs[0], /left\(name,37\)=.*\//);
  assert.match(inputs[0], /bucket_id='wholesale-order-lists'/);
  assert.throws(() => api.readWholesaleOrderAttachmentObjects("' or true--"));
  assert.equal(inputs.length, 1);
  const bytes = fs.readFileSync(
    "tests/test-support/fixtures/wholesale-order-list.xlsx",
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "41a249d9df002c081e2488aeac9e27f6a44a1a9d982da2f3c002c01f199b4635",
  );
});

/** 只执行原函数在登录之前的资源故障分支；Auth符号没有实现，也不会到达。 */
test("手动context创建页面失败时全部关闭，关闭错误与原失败均保留", async () => {
  const source = fs.readFileSync(
    "tests/e2e/helpers/wholesale-order-attachment-sharing.ts",
    "utf8",
  );
  const tree = ts.createSourceFile(
    "sharing.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const fn = tree.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.name.text === "verifyAttachmentSharing",
  );
  const body = ts.transpileModule(fn.getText(tree).replace(/^export /, ""), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  for (const failAt of [1, 2]) {
    let created = 0;
    const closed = [],
      options = [];
    const browser = {
      newContext: async (config) => {
        const id = ++created;
        options.push(config);
        return {
          newPage: async () => {
            if (id === failAt) throw Error("new-page-failed");
            return { unrouteAll: async () => {} };
          },
          close: async () => {
            closed.push(id);
            throw Error(`close-${id}`);
          },
        };
      },
    };
    const run = vm.runInNewContext(`${body};verifyAttachmentSharing`, {
      assert,
      cleanupFixtureResources,
      createAttachmentPageScope: () => ({ cleanup: async () => {} }),
    });
    let failure;
    try {
      await run(browser, "http://localhost:3000");
    } catch (error) {
      failure = error;
    }
    assert(failure);
    assert.match(failure.errors[0].message, /new-page-failed/);
    assert.equal(closed.length, failAt);
    assert(
      options.every((option) => option.baseURL === "http://localhost:3000"),
    );
    const errors = failure.errors.flatMap((error) => error.errors ?? [error]);
    assert.equal(errors.length, failAt + 1);
  }
});
