import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  parseEnvironment,
  isLocalEndpoint,
  isLocalJobEndpoint,
} from "./doctor-checks.mjs";
import { isDeclaredLocalApi, readDeclaredApiPort } from "./local-api-config.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const container = "supabase_db_pt5-dropshipping";
const roles = new Set([
  "administrator",
  "manager",
  "operator",
  "recruiter",
  "salesman",
  "promoter",
  "finance",
  "client",
]);

/** 专供本机夹具准备和独立核对；调用方只操作自己的运行编号，不记录配置值。 */
export function executeLearningSql(sql) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "-e",
      "PGPASSWORD=postgres",
      container,
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}

/** 合成账号的密码只存在内存，用真实登录表单建立会话；固定种子账号完全不变。 */
export async function createLearningUser(role = "administrator") {
  assert(roles.has(role), "练习角色不在明确清单中");
  const env = parseEnvironment(
    fs.readFileSync(path.join(root, ".env.local"), "utf8"),
  );
  assert(isLocalEndpoint(env.NEXT_PUBLIC_SUPABASE_URL), "练习只允许本地地址");
  const apiPort = readDeclaredApiPort(fs.readFileSync(path.join(root, "../PT5-dropshipping-supabase/supabase/config.toml"), "utf8"));
  assert(isDeclaredLocalApi(env.NEXT_PUBLIC_SUPABASE_URL, apiPort), "练习地址必须与项目声明的本机 API 端口一致");
  const project = execFileSync(
    "docker",
    [
      "inspect",
      "--format",
      '{{index .Config.Labels "com.supabase.cli.project"}}',
      container,
    ],
    { encoding: "utf8" },
  ).trim();
  assert.equal(project, "pt5-dropshipping");
  assert.equal(
    executeLearningSql(
      "select (select count(*) from cron.job where active)+(select count(*) from net.http_request_queue);",
    ),
    "0",
    "先隔离后台外部任务",
  );
  const endpoints = JSON.parse(
    executeLearningSql(
      "select coalesce(json_agg(endpoint),'[]') from public.internal_job_request_secrets;",
    ),
  );
  assert(
    endpoints.length > 0 && endpoints.every(endpoint => isLocalJobEndpoint(endpoint, apiPort)),
    "任务调用地址未隔离，先运行 doctor 排查。",
  );
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const runId = randomUUID();
  const email = `learning-${runId}@example.invalid`;
  const password = `Learning!${randomUUID()}`;
  const created = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: `学习验收 ${runId}`, business_board: "wholesale" },
  });
  assert.equal(created.error, null, "本地合成账号创建失败");
  const id = created.data.user.id;
  assert(/^[a-f0-9-]{36}$/.test(id));
  async function cleanup() {
    // 先注销本次账号会话；删除用户不会自动使已经签发的访问令牌失效。
    executeLearningSql(`begin;
      do $$ begin
        if not exists(select 1 from auth.users where id='${id}' and email='${email}') then
          raise exception '练习账号归属不符，停止清理';
        end if;
      end $$;
      delete from auth.sessions where user_id='${id}';
      -- 注册会自动创建本人的批发档案；只有自建且仍无业务引用的合成档案可以先删除。
      -- 外键会拒绝已经产生订单的档案，不关闭保护触发器或删除共享资料。
      delete from public.wholesale_customers where registered_user_id='${id}' and created_by_user_id='${id}';
      commit;`);
    const deleted = await client.auth.admin.deleteUser(id);
    assert.equal(deleted.error, null, "请保留本次编号排查账号清理");
    assert.equal(
      executeLearningSql(`select count(*) from auth.users where id='${id}';`),
      "0",
    );
    assert.equal(
      executeLearningSql(
        `select count(*) from public.user_home_widget_layouts where user_id='${id}';`,
      ),
      "0",
    );
    return { userRows: 0, layoutRows: 0 };
  }
  try {
    executeLearningSql(`begin;
      update public.user_profiles set name='学习验收 ${runId}',status='active' where user_id='${id}';
      delete from public.user_roles_data where user_id='${id}';
      insert into public.user_roles_data(user_id,role_id)
        select '${id}',id from public.user_roles where role='${role}';
      commit;`);
    assert.equal(
      executeLearningSql(
        `select count(*) from public.user_profiles where user_id='${id}' and status='active';`,
      ),
      "1",
    );
    // Web 从数据库读岗位，Edge 从 Auth 的服务端 metadata 读岗位；夹具必须让两处事实一致。
    const synced = await client.auth.admin.updateUserById(id, {
      app_metadata: { role, status: "active" },
    });
    assert.equal(synced.error, null, "本地练习账号权限同步失败");
  } catch (error) {
    await cleanup();
    throw error;
  }
  return { id, runId, email, password, client, cleanup };
}

export async function loginLearningUser(page, fixture, expectedPath = /\/(admin|manager|operator|recruiter|salesman|promoter|finance|client)\/home/) {
  await page.goto("http://localhost:3000/login");
  await page.locator('input[name="email"]').fill(fixture.email);
  await page.locator('input[name="password"]').fill(fixture.password);
  await Promise.all([
    page.waitForURL(
      // 默认等待工作台。未开通业务的用例需显式指定预期落点，仍必须完成真实登录。
      expectedPath,
      { timeout: 45000 },
    ),
    page.locator('form button[type="submit"]').click(),
  ]);
  await page.waitForLoadState("networkidle");
  // 公告随页面语言切换；直接复用正式文案，避免英文弹窗未关闭、遮挡后续页面操作。
  const locale = (await page.locator("html").getAttribute("lang")) === "en" ? "en" : "zh";
  const messages = JSON.parse(fs.readFileSync(path.join(root, "messages", `${locale}.json`), "utf8"));
  const announcement = page
    .getByRole("dialog")
    .getByRole("button", { name: messages.DashboardShell.announcements.acknowledge, exact: true });
  if (await announcement.isVisible()) {
    await announcement.click();
    await announcement.waitFor({ state: "hidden" });
  }
}
