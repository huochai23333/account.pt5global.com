# 批发结汇发布与多订单分配测试收尾

原综合入口的源码审查已完成。财务、业务员和原页面路由保持，使用独占客户、两张确定额度的订单和手工汇率。原认证页面、真实供应商、完整回归及生产构建仍待验收，整体为 `partial_failed`。

| 文件 | 行数 | 职责 |
| --- | ---: | --- |
| `tests/e2e/wholesale-settlement-releases.spec.ts` | 404 → 265 | 原岗位页面、分配与冲销场景、刷新和布局断言 |
| `tests/e2e/helpers/wholesale-release-page.ts` | 新 247 | 专属页面生命周期、发布与取消回包、故障路由和布局 |
| `tests/test-support/wholesale-release-case.ts` | 新 230 | 固定阶段、独立数据版本、限定回收 |
| `tests/test-support/wholesale-release-receipts.ts` | 新 342 | 订单和报价归属、收款终态、分配与冲销金额 |
| `tests/test-support/wholesale-release-seed.ts` | 新 104 | 真实岗位、专属客户/订单、手工报价准备 |
| `tests/test-support/settlement-repair-sql.ts` | 142 → 147 | 两套结汇用例共享锁内准备和版本回收 |
| `scripts/learning/wholesale-release-fixture.test.mjs` | 新 189 | 旧数据、未知提交、同值版本漂移与回包丢失 |

Web 质量门禁采用 Non-rendered 路径。本批改动测试，原产品页双语和 1440／390／320px 布局未运行。定向 ESLint、五个实际安全类型根、六根局部声明类型、原标题及认证调用和路由对照均通过。原补价 SQL 的准备、读取及清理输出与批前一致。9 项离线回归通过，包含本批 4 项与受共享 SQL 影响的原补价 5 项。README 和[结汇维护指南](../explanation/wholesale-settlement-release-flow.md)同步。

隔离 PostgreSQL 的 27 次夹具 SQL 按 168 表比较数据及行版本。财务发布三笔收款，重试发布号返回相同编号。正式收款 `7b1fbf15-251c-4668-8c85-2c4accfbf897` 依次保存 1,000／500、1,600／1,400 USD，再恢复为待分配。修订 0 → 1 → 2 → 3，原四条分配历史保留并标记冲销，关联结汇为零。手填收款 `57ec8f72-8212-4706-ab6a-1399884e7bb7` 关联正式客户，500 USD 按 7.128 结汇 3,564 元。实际月度查询为 0 → 1,500 → 3,000 → 0 → 500 USD。

九个拒绝路径包括业务员发布越权、客户分配越权、重复取消、重复旧修订、超额、外部 SET NULL 引用和未知提交。正式函数还在回滚事务内写入同总额但逐笔颠倒的分配，新增凭证检查拒绝该结果，回滚后 168 表的记录与版本一致。清空后的再次清空仍返回修订 3，数据不变。

真实 Chrome 的两个回环协议检查验证同路径其他收款和 GET 不会被用作取消凭证，500 故障只作用于指定收款，移除路由后才转发请求。两个测试页均关闭后执行回收并记录附件。浏览器使用合成 HTTP 和 SQL 端口。原认证和正式页面未运行。

正例独立读回回收 3 笔收款、5 条分配、1 条结汇、2 张订单、2 条提成、客户及其档案/目录和 1 条手工报价，相关范围恢复为空。保留外部引用故障的凭证后，隔离实例和重复结构备份已清理。主库调度暂停，活动任务及队列均为 0，历史任务 269。证据见 Web `output/learning-wholesale-release-20261111/` 和 `output/test-runs/`。上传、Cloud 写入和部署未执行。
