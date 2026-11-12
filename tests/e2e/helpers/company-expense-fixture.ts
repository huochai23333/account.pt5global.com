import { randomUUID } from "node:crypto";

import { expect, test as base } from "@playwright/test";

import { getLocalSupabaseAdminClient } from "./local-supabase-admin";

type ExpenseFixture = {
  title: string;
  expectSaved: (month: string) => Promise<void>;
  expectAbsent: () => Promise<void>;
};

// 仅声明 expenseFixture 的用例才取得管理员读回与清理能力。
// 原认证入口仍由测试调用 loginAs，执行前提继续遵守原套件准入记录。
export const test = base.extend<{ expenseFixture: ExpenseFixture; }>({
  expenseFixture: async ({ baseURL }, provideExpense) => {
    if (!baseURL || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
      throw new Error("company_expense_fixture_requires_local_application");
    }
    const admin = getLocalSupabaseAdminClient();
    base.skip(!admin, "需要本地管理员读回能力核对费用和清理结果。");
    if (!admin) throw new Error("local_supabase_admin_required");
    const title = `自动测试费用 ${randomUUID()}`;
    let savedId: string | undefined;

    const expectAbsent = async () => {
      const { count, error } = await admin
        .from("company_expenses")
        .select("id", { count: "exact", head: true })
        .eq("title", title);
      expect(error).toBeNull();
      expect(count).toBe(0);
    };

    try {
      await provideExpense({
        title,
        expectAbsent,
        expectSaved: async (month) => {
          const { data, error } = await admin
            .from("company_expenses")
            .select("id,title,category,amount,currency_code,expense_month,payee,note,created_by_user_id")
            .eq("title", title)
            .single();
          expect(error).toBeNull();
          expect(data).toMatchObject({
            title, category: "office", currency_code: "CNY", expense_month: `${month}-01`,
            payee: "自动测试收款方", note: "用于公司费用页面回归测试",
          });
          if (!data) throw new Error("expense_test_record_missing");
          expect(Number(data.amount)).toBe(123.45);
          expect(data.id).toMatch(/^[0-9a-f-]{36}$/i);
          expect(data.created_by_user_id).toMatch(/^[0-9a-f-]{36}$/i);
          // 刷新和取消删除后的读取必须仍是同一条记录，不能只比较标题。
          if (savedId) expect(data.id).toBe(savedId);
          savedId = data.id;
        },
      });
    } finally {
      // 页面中途失败也回收自有 UUID 标题，随后查表确认零行。
      const { error } = await admin
        .from("company_expenses")
        .delete()
        .eq("title", title);
      expect(error).toBeNull();
      await expectAbsent();
    }
  },
});
