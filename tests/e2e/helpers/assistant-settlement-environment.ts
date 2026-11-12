import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { Browser, Page, TestInfo } from "@playwright/test";
import { createAssistantSettlementCase } from "../../test-support/assistant-settlement-case";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";
import { runLocalSupabaseSql } from "./local-supabase";

type Fixture = ReturnType<typeof createAssistantSettlementCase>;
type Mode = Parameters<typeof createAssistantSettlementCase>[1];

/** 路由在服务端写入。先核对运行中的 Web 实际使用同一专属 API 和本机假供应商。 */
async function verifyAssistantServer(app: URL, api: URL) {
  const probe = new URL("/api/learning-mail-ai-probe", app);
  probe.searchParams.set("expectedApi", api.href);
  const response = await fetch(probe, {
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });
  assert(response.ok, "assistant_settlement_local_probe_required");
  const proof = await response.json();
  assert(
    proof?.localMock === true && proof?.sameProject === true,
    "assistant_settlement_server_target_unconfirmed",
  );
}

/** 结汇指令必须走确定性分支。若误入模型，只有本地固定 503，并登记异常次数。 */
async function rejectUnexpectedProvider() {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response
      .writeHead(503, { "content-type": "application/json" })
      .end('{"error":"unexpected_model_call"}');
  });
  server.requestTimeout = 5_000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(4110, "127.0.0.1", resolve);
  });
  return {
    requests: () => requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

export async function withAssistantSettlementEnvironment(
  browser: Browser,
  info: TestInfo,
  mode: Mode,
  exercise: (fixture: Fixture, open: () => Promise<Page>) => Promise<void>,
) {
  const fixture = createAssistantSettlementCase(runLocalSupabaseSql, mode);
  const app = new URL(process.env.PLAYWRIGHT_BASE_URL!),
    api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  await verifyAssistantServer(app, api);
  const provider = await rejectUnexpectedProvider();
  const pages: Page[] = [];
  let forbiddenOrigin = false,
    pagesClosed = false,
    providerClosed = false;
  let failure: { cause: unknown } | undefined, receipt: unknown;
  async function open() {
    const page = await browser.newPage({ serviceWorkers: "block" });
    pages.push(page);
    await page.route(/^https?:\/\//, (route) => {
      if (
        [app.origin, api.origin].includes(new URL(route.request().url()).origin)
      )
        return route.continue();
      forbiddenOrigin = true;
      return route.abort("blockedbyclient");
    });
    return page;
  }
  try {
    fixture.prepare();
    await exercise(fixture, open);
    assert(
      provider.requests() === 0,
      "assistant_settlement_provider_requested",
    );
  } catch (cause) {
    failure = { cause };
  } finally {
    await cleanupFixtureResources(
      async () => {
        if (failure) throw failure.cause;
      },
      async () => {
        await cleanupFixtureResources(
          ...pages.map((page) => async () => {
            if (!page.isClosed()) {
              await page.unrouteAll({ behavior: "wait" });
              await page.close();
            }
          }),
        );
        pagesClosed = pages.every((page) => page.isClosed());
      },
      async () => {
        await provider.close();
        providerClosed = true;
      },
      async () => {
        assert(
          pagesClosed && providerClosed && !forbiddenOrigin,
          "assistant_settlement_cleanup_boundary",
        );
        receipt = fixture.cleanup();
      },
      async () =>
        info.attach("assistant-settlement-case", {
          body: JSON.stringify(
            {
              ...fixture.evidence(),
              modelRequests: provider.requests(),
              pagesClosed,
              providerClosed,
              forbiddenOrigin,
              receipt,
            },
            null,
            2,
          ),
          contentType: "application/json",
        }),
    );
  }
}
