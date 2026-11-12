import { createClient } from "@supabase/supabase-js";
import { runDocumentCleanup } from "../../PT5-dropshipping-supabase/supabase/functions/_shared/document-cleanup.ts";
import { readDisposablePostgresTarget } from "../tests/test-support/disposable-fixture.ts";
import { createLocalDocumentCleanupPort } from "./document-cleanup-local-port.mjs";
import { execFileSync } from "node:child_process";

// claim 会认领整个实例的过期待清理项，必须使用实际可重建的专属项目，不能在共享库试跑。
readDisposablePostgresTarget({
  baseURL: process.env.PLAYWRIGHT_BASE_URL,
  supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  mode: process.env.PT5_E2E_FIXTURE_MODE,
  project: process.env.PT5_E2E_DATABASE_PROJECT,
  container: process.env.PT5_E2E_DATABASE_CONTAINER,
}, args => execFileSync("docker", args, { encoding: "utf8", timeout: 8000, windowsHide: true }));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// API绑定由专属网关的实际端口证明；不借用共享项目config，也不从共享.env.local补认证。
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const result = await runDocumentCleanup(createLocalDocumentCleanupPort(admin));
// 结果只含编号、计数和终态，不记录配置或凭据；部分失败也必须让调用方收到失败退出码。
process.stdout.write(JSON.stringify(result));
if (result.status !== "succeeded") process.exitCode = 1;
