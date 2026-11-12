import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createClient } from "@supabase/supabase-js";

// 这组纯模块只接受传入的 SDK 客户端；解析器拒绝账号、管理员入口和其他本地模块。
const paths = [
  "mail-fixture-records",
  "mail-fixture-identity",
  "mail-fixture-reset",
  "mail-fixture-mailbox",
  "mail-fixture-agents",
  "mail-fixture-messages",
];
const allowed = new Set(
  paths.map(
    (name) => new URL("../e2e/helpers/" + name + ".ts", import.meta.url).href,
  ),
);
allowed.add(new URL("../../lib/mail/mail-security.ts", import.meta.url).href);
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (allowed.has(context.parentURL) && specifier.startsWith(".")) {
      const target = new URL(specifier + ".ts", context.parentURL).href;
      assert(allowed.has(target), "独立邮件数据检查不得解析认证入口");
      return next(target, context);
    }
    return next(specifier, context);
  },
});
export let records, identity, reset, mailbox, agents, messages, security;
try {
  [records, identity, reset, mailbox, agents, messages, security] =
    await Promise.all([
      ...paths.map((name) => import("../e2e/helpers/" + name + ".ts")),
      import("../../lib/mail/mail-security.ts"),
    ]);
} finally {
  hook.deregister();
}

export function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** 真实 SDK 的 HTTP 传输替换为内存存储；验证编码/凭证边界，不连接数据库或 Auth。 */
export function mailFixtureStore({ initial = {}, override } = {}) {
  const rows = structuredClone(initial);
  const calls = [];
  const client = createClient(
    "http://127.0.0.1:54321",
    "synthetic-fixture-api-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input, init) => {
          const request = new Request(input, init),
            url = new URL(request.url);
          assert.equal(url.origin, "http://127.0.0.1:54321");
          assert(url.pathname.startsWith("/rest/v1/"));
          const table = url.pathname.split("/").at(-1);
          const call = {
            method: request.method,
            table,
            query: url.searchParams,
            headers: request.headers,
            body: request.method === "POST" ? await request.json() : undefined,
          };
          calls.push(call);
          const replacement = await override?.(call, rows);
          if (replacement) return replacement;
          rows[table] ??= [];
          if (call.method === "POST") {
            const inserted = Array.isArray(call.body) ? call.body : [call.body];
            rows[table].push(...structuredClone(inserted));
            return jsonResponse(inserted, 201);
          }
          if (call.method === "DELETE") {
            const removed = rows[table].length;
            rows[table] = [];
            return new Response(null, {
              status: 204,
              headers: { "content-range": `*/${removed}` },
            });
          }
          if (call.method === "HEAD")
            return new Response(null, {
              status: 200,
              headers: { "content-range": `*/${rows[table].length}` },
            });
          let selected = rows[table];
          for (const [key, filter] of url.searchParams) {
            if (filter.startsWith("in.(")) {
              const values = filter
                .slice(4, -1)
                .split(",")
                .map((value) => value.replace(/^"|"$/g, ""));
              selected = selected.filter((row) => values.includes(row[key]));
            }
          }
          return jsonResponse(selected);
        },
      },
    },
  );
  return { client, rows, calls };
}
