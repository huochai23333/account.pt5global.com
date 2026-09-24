import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";
import { runLocalSupabaseSql } from "./helpers/local-supabase";

const TARGET_USER_ID = "55555555-5555-4555-8555-555555555555";

test("旧 Auth 写入晚到后，刷新人员页仍可看到并完成补偿", async ({ page }) => {
  test.setTimeout(90_000);
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "需要本地数据库与 Auth 管理连接。");
  if (!admin) return;

  // 仅备份本地种子账号相关的两项状态；用例结束时逐项恢复，避免影响别的角色回归。
  const snapshot = JSON.parse(runLocalSupabaseSql(`select jsonb_build_object(
    'auth', (select raw_app_meta_data from auth.users where id = '${TARGET_USER_ID}'),
    'sync', (select to_jsonb(sync_row) from public.admin_auth_metadata_sync as sync_row where user_id = '${TARGET_USER_ID}')
  )::text;`)) as { auth: Record<string, unknown>; sync: Record<string, unknown> | null };
  try {
    runLocalSupabaseSql(`
      update auth.users set raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"client"'::jsonb)
      where id = '${TARGET_USER_ID}';
      insert into public.admin_auth_metadata_sync (user_id, desired_role, desired_status, sync_status, synced_at)
      values ('${TARGET_USER_ID}', 'salesman', 'active', 'synced', now())
      on conflict (user_id) do update set desired_role = 'salesman', desired_status = 'active', sync_status = 'synced', synced_at = now();`);

    await loginAs(page, "administrator");
    await page.goto("/admin/accounts");
    const openPerson = page.getByRole("button", { name: "查看 本地业务员 的账号详情" });
    await openPerson.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("账号已调整，登录信息尚未更新。请打开该账号并重试更新登录信息。")).toBeVisible();
    await page.reload();
    await openPerson.click();
    await expect(dialog.getByRole("button", { name: "重试更新登录信息" })).toBeVisible();
    await dialog.getByRole("button", { name: "重试更新登录信息" }).click();
    // 页面操作后独立读取 Auth 和补偿回执，确认角色、状态与最终版本都已一致。
    await expect.poll(async () => {
      const [{ data: userResult }, { data: row }] = await Promise.all([
        admin.auth.admin.getUserById(TARGET_USER_ID),
        admin.from("admin_auth_metadata_sync").select("desired_role,sync_status").eq("user_id", TARGET_USER_ID).single(),
      ]);
      return { role: userResult.user?.app_metadata?.role, syncStatus: row?.sync_status, desiredRole: row?.desired_role };
    }).toEqual({ role: "salesman", syncStatus: "synced", desiredRole: "salesman" });
    await page.reload();
    await openPerson.click();
    await expect(dialog.getByRole("button", { name: "重试更新登录信息" })).toHaveCount(0);
  } finally {
    const authBase64 = Buffer.from(JSON.stringify(snapshot.auth)).toString("base64");
    runLocalSupabaseSql(`update auth.users set raw_app_meta_data = convert_from(decode('${authBase64}', 'base64'), 'UTF8')::jsonb
      where id = '${TARGET_USER_ID}';`);
    if (snapshot.sync) {
      const syncBase64 = Buffer.from(JSON.stringify(snapshot.sync)).toString("base64");
      runLocalSupabaseSql(`insert into public.admin_auth_metadata_sync
        select * from jsonb_populate_record(null::public.admin_auth_metadata_sync,
          convert_from(decode('${syncBase64}', 'base64'), 'UTF8')::jsonb)
        on conflict (user_id) do update set desired_role = excluded.desired_role,
          desired_status = excluded.desired_status, sync_status = excluded.sync_status,
          updated_at = excluded.updated_at, synced_at = excluded.synced_at;`);
    } else {
      runLocalSupabaseSql(`delete from public.admin_auth_metadata_sync where user_id = '${TARGET_USER_ID}';`);
    }
  }
});
