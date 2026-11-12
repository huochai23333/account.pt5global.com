import { randomUUID } from "node:crypto";

import { expect, test as base } from "@playwright/test";

import { getLocalSupabaseAdminClient } from "./local-supabase-admin";

type ClientBusinessFixture = {
  email: string;
  name: string;
  expectLinked: () => Promise<void>;
};

// 夹具只准备并清理自己的临时账号，业务添加仍由原测试登录后从页面发起。
export const test = base.extend<{ clientBusinessFixture: ClientBusinessFixture; }>({
  clientBusinessFixture: async ({ baseURL }, provideClient) => {
    if (!baseURL || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
      throw new Error("client_business_fixture_requires_local_application");
    }
    const admin = getLocalSupabaseAdminClient();
    base.skip(!admin, "必须连接本地 Docker Supabase 才能核对客户业务权限凭证。");
    if (!admin) throw new Error("local_supabase_admin_required");
    const run = randomUUID();
    const email = `e2e.client-business.${run}@example.test`;
    const name = `业务客户回归 ${run.slice(0, 8)}`;
    let userId: string | undefined;
    let savedCustomerId: string | undefined;
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email, email_confirm: true,
        app_metadata: { role: "client", status: "active" },
        user_metadata: { name, business_board: "wholesale" },
      });
      userId = data.user?.id;
      expect(error).toBeNull();
      if (!userId) throw new Error("client_business_fixture_user_missing");
      // 注册触发器会先赋予所选业务；本测试要从“尚未加入”的状态验证管理员添加流程。
      const { error: initialCustomerError } = await admin.from("wholesale_customers")
        .delete().eq("registered_user_id", userId);
      expect(initialCustomerError).toBeNull();
      const { error: initialAccessError } = await admin.from("user_workspace_business_access")
        .delete().eq("user_id", userId).eq("business_key", "wholesale");
      expect(initialAccessError).toBeNull();
      const { data: role, error: roleError } = await admin.from("user_roles")
        .select("id").eq("role", "client").single();
      expect(roleError).toBeNull();
      const { error: profileError } = await admin.from("user_profiles").upsert({
        user_id: userId, name: name, email: email, status: "active", city: "上海",
      });
      expect(profileError).toBeNull();
      const { error: userRoleError } = await admin.from("user_roles_data")
        .upsert({ user_id: userId, role_id: role?.id });
      expect(userRoleError).toBeNull();

      await provideClient({
        email, name,
        expectLinked: async () => {
          // 固定临时账号编号独立核对访问记录与正式客户，不能只看成功提示。
          const [{ data: access, error: accessError }, { data: customer, error: customerError }] =
            await Promise.all([
              admin
                .from("user_workspace_business_access")
                .select("business_key,is_enabled")
                .eq("user_id", userId)
                .eq("business_key", "wholesale")
                .single<{ business_key: string; is_enabled: boolean; }>(),
              admin
                .from("wholesale_customers")
                .select("id,registered_user_id")
                .eq("registered_user_id", userId)
                .single<{ id: string; registered_user_id: string; }>(),
            ]);
          if (accessError) throw accessError;
          if (customerError) throw customerError;
          expect(access).toEqual({ business_key: "wholesale", is_enabled: true });
          expect(customer.id).toEqual(expect.any(String));
          expect(customer.registered_user_id).toBe(userId);
          if (savedCustomerId) expect(customer.id).toBe(savedCustomerId);
          savedCustomerId = customer.id;

        },
      });
    } finally {
      if (userId) {
        const { error: customerError } = await admin.from("wholesale_customers")
          .delete().eq("registered_user_id", userId);
        expect(customerError).toBeNull();
        const { count, error: countError } = await admin.from("wholesale_customers")
          .select("id", { count: "exact", head: true }).eq("registered_user_id", userId);
        expect(countError).toBeNull();
        expect(count).toBe(0);
        const { error: userError } = await admin.auth.admin.deleteUser(userId);
        expect(userError).toBeNull();
        const { data, error: lookupError } = await admin.auth.admin.getUserById(userId);
        expect(data.user).toBeNull();
        expect(lookupError?.status).toBe(404);
      }
    }
  },
});
