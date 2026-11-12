import { type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { getRegressionAccount, type RegressionRole } from "./accounts";
import {
  getLocalSupabaseAdminClient,
  readLocalEnvValue,
} from "./local-supabase-admin";
import { loginAs } from "./auth";

/** 测试只允许连接本地 Docker，清理只按本次随机前缀和实际记录编号执行。 */
export function documentAdmin() {
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("local_supabase_required");
  return admin;
}

const noticeHandlers = new WeakSet<Page>();

export async function documentLogin(page: Page, role: RegressionRole) {
  // 无业务岗位先进入停用说明，公告可能在下一页才出现；从真实按钮确认，避免遮住资料操作。
  if (!noticeHandlers.has(page)) {
    noticeHandlers.add(page);
    await page.addLocatorHandler(
      page.getByRole("button", { name: "我知道了", exact: true }),
      async (button) => {
        await button.click();
      },
    );
  }
  // 同一浏览器切换角色必须先清除认证 Cookie，登录页否则会把旧身份送回原工作台。
  await page.context().clearCookies();
  await loginAs(page, role);
}

export async function documentUser(role: RegressionRole) {
  const result = await documentAdmin()
    .from("user_profiles")
    .select("user_id")
    .eq("email", getRegressionAccount(role).email)
    .single();
  if (result.error) throw result.error;
  return result.data.user_id as string;
}

export async function documentReader(role: RegressionRole) {
  const url = readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL")!;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url))
    throw new Error("local_supabase_required");
  const client = createClient(
    url,
    readLocalEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
      readLocalEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );
  const account = getRegressionAccount(role);
  const result = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (result.error) throw new Error("local_test_login_failed");
  return client;
}
