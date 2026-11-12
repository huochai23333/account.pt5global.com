import { test as base, expect, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppRole } from "../../lib/auth-routing";
import {
  createLearningUser,
  executeLearningSql,
} from "../../scripts/learning/local-fixture-session.mjs";

type LearningUser = Awaited<ReturnType<typeof createLearningUser>>;
// 验收角色沿用应用的岗位类型，新增岗位时由运行时夹具校验是否已支持。
type LearningRole = AppRole;
// 准备和清理需要真实 Docker/Auth 调用，单独计时，避免测试正文超时后挤占清理预算。
const OWNED_USER_TIMEOUT_MS = 30_000;

async function provideOwnedUser(
  role: LearningRole,
  provide: (user: LearningUser) => Promise<void>,
  testInfo: TestInfo,
  name: string,
) {
  const user = await createLearningUser(role);
  try {
    await provide(user);
  } finally {
    const cleanup = await user.cleanup();
    // 审核申请由账号外键清理；独立读回可以发现次要账号遗留，不能只核对默认账号。
    const profileRequestRows = Number(
      executeLearningSql(
        `select count(*) from public.user_profile_change_requests where user_id='${user.id}';`,
      ),
    );
    expect(profileRequestRows).toBe(0);
    const receipt = testInfo.outputPath(`${name}.json`);
    await mkdir(path.dirname(receipt), { recursive: true });
    await writeFile(
      receipt,
      JSON.stringify({ ...cleanup, profileRequestRows }, null, 2),
    );
    await testInfo.attach(name, {
      path: receipt,
      contentType: "application/json",
    });
  }
}

// 准备和清理位于同一个 test-scoped fixture；断言失败也要核对本次账号与布局已移除。
// 密码和客户端只在内存传递，附件只保存清理计数，不保存完整夹具或身份配置。
export const test = base.extend<{
  learningUser: LearningUser;
  learningRole: LearningRole;
  learningStaff: LearningUser;
  learningStaffRole: LearningRole;
  learningNextStaff: LearningUser;
}>({
  // 每个测试显式声明自己的岗位，不能改写共享固定账号来切换权限。
  learningRole: ["administrator", { option: true }],
  learningStaffRole: ["salesman", { option: true }],
  // provide 是 Playwright 的夹具交付回调，不是 React 的 use Hook。
  learningUser: [
    async ({ browserName, learningRole }, provide, testInfo) => {
      expect(browserName).toBe("chromium");
      await provideOwnedUser(
        learningRole,
        provide,
        testInfo,
        "owned-fixture-cleanup",
      );
    },
    { timeout: OWNED_USER_TIMEOUT_MS },
  ],
  // 第二个角色也有独立 teardown；测试正文超时或员工页面关闭失败时仍会清理。
  learningStaff: [
    async ({ browserName, learningStaffRole }, provide, testInfo) => {
      expect(browserName).toBe("chromium");
      await provideOwnedUser(
        learningStaffRole,
        provide,
        testInfo,
        "owned-staff-cleanup",
      );
    },
    { timeout: OWNED_USER_TIMEOUT_MS },
  ],
  // 转交用例的第三个账号也有独立清理预算，不能占用测试正文的剩余时间。
  learningNextStaff: [
    async ({ browserName }, provide, testInfo) => {
      expect(browserName).toBe("chromium");
      await provideOwnedUser("salesman", provide, testInfo, "owned-next-staff-cleanup");
    },
    { timeout: OWNED_USER_TIMEOUT_MS },
  ],
});

export { expect };
