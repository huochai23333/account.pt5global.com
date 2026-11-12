# 账号管理与私有备注

从管理员工作台的“账号管理”进入 `/admin/accounts`。全局页面先检查工作台路由配置，`getAdminPeoplePageData` 再从服务端会话确认启用的管理员身份。目录、最近十条账号变更和待同步提示分别读取。批发的客户档案、人员目录与这个全局账号页面分开维护。

## 账号变更与 Auth 同步

`use-admin-people-view-model.ts` 组合目录、筛选和两个编辑器。`use-admin-account-editor.ts` 保存打开弹窗时的账号快照。保存经 `/api/admin/people/account` 进入 `updateAdminPersonAccount`，服务端复查权限与快照，`admin_update_person_account_bundle` 在同一事务核对目标、变更账号和写审计。服务端核对日志编号、目标账号及业务范围，编辑器核对目标、角色、状态和城市。重复点击由编辑器同步拦截，过期快照由服务端和数据库拒绝。管理员不能通过此入口修改自己的账号。

新增显示字段时先看 `admin-people-contract.ts` 中的行字段，再沿 `admin-people.ts` 的查询和 `admin-people-rows.ts` 的归一找到数据来源。需要显示变更记录时，入口是 `admin-people-recent-changes.tsx`。服务端读取目录的模块具有 `server-only` 边界，浏览器使用独立的字段合同。[Next.js 服务端与客户端边界](https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning)

Auth 状态在另一服务中写入。`admin-people-auth-metadata.ts` 对照 `admin_auth_metadata_sync` 的当前版本和实际 Auth 角色、状态，确认后才关闭待办。数据库已提交但 Auth 未确认时，页面显示待同步。重试入口只接受账号编号，由服务端读取当前期望状态。

这段补偿逻辑的纯边界测试有两份：[迟到写入](../../../tests/unit/admin-auth-sync-race.mjs)让旧Auth写入晚于新版本，确认最后回到数据库最新角色；[读回中断](../../../tests/unit/admin-auth-sync-recovery.mjs)先保留明确失败和暂时偏差，再模拟新进程读取待办并恢复。两份VM模块共用显式内存数据库/Auth替身，不连接真实服务，也不表示真实多服务器或页面改账号已通过。

运行 `npm run test:admin-auth-sync` 会由 Node 原生测试运行器分别报告一个具名用例，每项5秒上限；不能只看脚本退出0。旧自执行异步函数若停在未释放屏障，可以没运行完断言便退出0。新的[测试完成性回归](../../../scripts/learning/auth-sync-test-completion.test.mjs)随 `npm run test:learning` 执行：仅在子进程输入中卡住这两份原脚本，必须得到超时/未完成诊断和非零退出，不能出现业务成功文字；不改磁盘源码。异步测试的完成规则见 [Node 24 测试运行器](https://nodejs.org/docs/latest-v24.x/api/test.html)。

## 备注的归属和回执

目录的“备注”打开 `PersonPrivateNoteDialog`。`usePersonPrivateNoteEditor` 维护草稿与提交锁，向 `/api/people/note` 提交人员编号和明确的备注值。`person-private-note-contract.ts` 集中校验请求和回执。文本经去除首尾空白后保存，显式空文本或 `null` 表示清空。缺字段、对象、数字等无效输入停止在接口边界。

`save_person_private_note` 用 `auth.uid()` 确定所有者，用 `can_current_user_note_visible_person` 核对启用状态和可见目标。管理员可对已确认邮箱且具有档案的账号记录备注；销售岗位需要客户推荐关系以及对应业务范围。`person_private_notes` 以所有者和目标编号为联合主键，读取策略按所有者隔离。另一位管理员查看同一账号时只会看到自己的备注。

非空保存核对原目标、正文和数据库更新时间，独立查询应只有一行。清空回执返回同一目标、空值及数据库时间，独立查询应为零行。页面刷新后应保持一致。测试使用两位专属本地管理员，从页面发起写入，并在失败和成功之后核对数据库。现有本地权限范围见[后端数据库说明](../../../../PT5-dropshipping-supabase/docs/onboarding/database.md)。

运行 `npm run test:learning:browser -- admin-account-receipts person-private-note`，准备与清理步骤见[验证手册](../how-to/verification.md)。账号事务与 Auth 恢复分别使用后端 `admin_person_account_bundle.sql` 和 Web 的 `npm run test:admin-auth-sync`。事务测试使用可重建的隔离实例。
