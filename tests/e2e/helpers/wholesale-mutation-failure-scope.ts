import assert from "node:assert/strict";
import { test as base, expect, type Page, type Route } from "@playwright/test";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";
import { readLocalPostgresRows } from "./local-postgres-query";

export const FORCED_ERROR_MESSAGE = "操作没有成功，请检查内容和权限后再试。";
const readFunctions = new Set([
  "get_wholesale_order_page",
  "get_wholesale_order_client_contacts",
  "get_wholesale_logistics_store_options",
  "get_wholesale_logistics_page",
  "get_wholesale_referral_waybill_monthly_counts",
  "list_wholesale_customer_link_candidates",
  "get_wholesale_referral_commission_rows",
  "get_monthly_settlement_allocated_usd",
]);
const endpoints = {
  "create-order": "/rest/v1/rpc/create_wholesale_order",
  "edit-order": "/rest/v1/rpc/update_wholesale_order",
  settlement: "/rest/v1/rpc/add_wholesale_order_settlement",
  "upload-list": "/storage/v1/object/wholesale-order-lists/",
  alias: "/rest/v1/rpc/append_wholesale_customer_other_names",
  "link-account": "/rest/v1/rpc/link_wholesale_customer_registered_user",
  assignment: "/rest/v1/rpc/change_wholesale_logistics_store_assignment",
  referral: "/rest/v1/wholesale_referrals",
  release: "/rest/v1/rpc/create_wholesale_settlement_release",
} as const;
export type FailureOperation = keyof typeof endpoints;
type Intent = {
  operation: FailureOperation;
  completed: number;
  started: boolean;
  consumed: boolean;
};
const scopes = new WeakMap<Page, ReturnType<typeof createFailureBoundary>>();

/** 所有批发底表及编号计数器逐表摘要包含xmin；对象目录保留内容version，排除访问记账时间。 */
export function readWholesaleFailureProof() {
  const tables = readLocalPostgresRows<{ name: string }>(
    "select c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace " +
      "where n.nspname='public'and c.relkind='r'and (left(c.relname,10)='wholesale_'or c.relname='order_number_counter')order by c.relname",
  );
  assert(
    tables.length > 0 &&
      tables.every((row) =>
        /^(?:wholesale_[a-z0-9_]+|order_number_counter)$/.test(row.name),
      ),
    "failure_proof_tables_missing",
  );
  const queries = tables.map(
    ({ name }) =>
      `select '${name}'as name,md5(coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('_xmin',xmin::text)order by to_jsonb(t)::text),'[]'::jsonb)::text)as digest from public.${name} t`,
  );
  queries.push(
    "select 'storage.wholesale-order-lists'as name,md5(coalesce(jsonb_agg(to_jsonb(t)-'last_accessed_at'-'updated_at'order by name),'[]'::jsonb)::text)as digest from storage.objects t where bucket_id='wholesale-order-lists'",
  );
  return readLocalPostgresRows<{ name: string; digest: string }>(
    `select * from (${queries.join(" union all ")})proof order by name`,
  );
}

/** 失败场景不允许写穿：原Auth只放行本地token/登出，其余写入必须先声明且只回固定失败。 */
export function createFailureBoundary(apiOrigin: string) {
  const origin = new URL(apiOrigin);
  assert(
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) &&
      !origin.username &&
      !origin.password,
    "failure_boundary_requires_local_api",
  );
  const intents: Intent[] = [],
    unexpected: string[] = [];
  const handlers: unknown[] = [];
  function deny(route: Route, reason: string) {
    unexpected.push(reason);
    return route.abort();
  }
  return {
    declare(operation: FailureOperation) {
      assert(Object.hasOwn(endpoints, operation), "failure_operation_unknown");
      assert(
        !intents.some((intent) => intent.operation === operation),
        "failure_operation_repeated",
      );
      intents.push({
        operation,
        completed: 0,
        started: false,
        consumed: false,
      });
    },
    async handle(route: Route) {
      try {
        const request = route.request(),
          url = new URL(request.url()),
          method = request.method();
        const localApi = url.origin === origin.origin;
        if (method === "OPTIONS") {
          // 跨端口请求先检查允许的方法/请求头；预检不执行业务，不能当成写入命中。
          await route.continue();
          return;
        }
        if (localApi && url.pathname.startsWith("/auth/v1/")) {
          const grant = url.searchParams.get("grant_type");
          if (
            (method === "POST" &&
              url.pathname === "/auth/v1/token" &&
              ["password", "refresh_token"].includes(grant ?? "")) ||
            (method === "POST" && url.pathname === "/auth/v1/logout") ||
            (["GET", "HEAD", "OPTIONS"].includes(method) &&
              url.pathname === "/auth/v1/user")
          ) {
            await route.continue();
            return;
          }
          await deny(route, "failure_boundary_unexpected_auth_write");
          return;
        }
        if (url.pathname.startsWith("/rest/v1/rpc/")) {
          const name = url.pathname.slice("/rest/v1/rpc/".length);
          if (
            localApi &&
            readFunctions.has(name) &&
            ["GET", "HEAD", "POST", "OPTIONS"].includes(method)
          ) {
            await route.continue();
            return;
          }
          // GET调用的函数也可能有副作用，不能把未知函数按HTTP动词当成只读。
        } else if (["GET", "HEAD", "OPTIONS"].includes(method)) {
          await route.continue();
          return;
        }
        if (!localApi) {
          await deny(route, "failure_boundary_foreign_write");
          return;
        }
        const intent = intents.find((intent) =>
          intent.operation === "upload-list"
            ? url.pathname.startsWith(endpoints[intent.operation])
            : url.pathname === endpoints[intent.operation],
        );
        if (!intent || method !== "POST") {
          await deny(route, "failure_boundary_undeclared_write");
          return;
        }
        if (intent.started) {
          await deny(route, "failure_boundary_duplicate_write");
          return;
        }
        intent.started = true;
        // 不转发、不改请求、不打印正文或令牌；只有失败回包完成，页面断言才可消费此凭证。
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            code: "P0001",
            details: null,
            hint: null,
            message: "e2e_forced_failure",
          }),
        });
        intent.completed++;
      } catch (error) {
        handlers.push(error);
        try {
          await route.abort();
        } catch (abortError) {
          handlers.push(abortError);
        }
      }
    },
    async consume() {
      const intent = intents.find((intent) => !intent.consumed);
      assert(intent, "failure_boundary_pending_intent_missing");
      await expect
        .poll(() => intent.completed, {
          message: "本次指定写请求必须收到固定失败回包",
        })
        .toBe(1);
      intent.consumed = true;
    },
    verify() {
      const failures = [...handlers];
      if (unexpected.length) failures.push(new Error(unexpected.join(",")));
      if (
        !intents.length ||
        intents.some((intent) => intent.completed !== 1 || !intent.consumed)
      )
        failures.push(new Error("failure_boundary_unfinished_intent"));
      if (failures.length)
        throw new AggregateError(failures, "failure_boundary_not_verified");
    },
  };
}

// 自动夹具覆盖原四个场景；Service Worker停用，避免请求绕过Playwright拦截。
export const test = base.extend<{ wholesaleFailureBoundary: void }>({
  wholesaleFailureBoundary: [
    async ({ page }, use) => {
      const baseline = readWholesaleFailureProof();
      const scope = createFailureBoundary(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
      );
      scopes.set(page, scope);
      await cleanupFixtureResources(
        async () => {
          // 安装拦截也在收尾保护内；安装失败时仍排空、查库并解除本次绑定。
          await page.route("**/*", (route) => scope.handle(route));
          await use();
        },
        () => page.unrouteAll({ behavior: "wait" }),
        async () => scope.verify(),
        async () =>
          assert.deepEqual(
            readWholesaleFailureProof(),
            baseline,
            "failure_boundary_business_data_changed",
          ),
        async () => {
          scopes.delete(page);
        },
      );
    },
    { auto: true },
  ],
});
test.use({ serviceWorkers: "block" });

export async function failJsonRequest(page: Page, operation: FailureOperation) {
  const scope = scopes.get(page);
  assert(scope, "failure_boundary_not_installed");
  scope.declare(operation);
}
export async function expectInterceptedFailure(page: Page) {
  const scope = scopes.get(page);
  assert(scope, "failure_boundary_not_installed");
  await scope.consume();
}
export async function expectFailureNotice(page: Page) {
  await expectInterceptedFailure(page);
  // Next空的路由播报区也有alert角色，只匹配原业务提示。
  await expect(
    page.getByRole("alert").filter({ hasText: FORCED_ERROR_MESSAGE }),
  ).toBeVisible();
}
