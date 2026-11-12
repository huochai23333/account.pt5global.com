# 中行综合测试的任务凭证与回收

原中行综合测试的源码审查已完成。整体改造仍为 `partial_failed`，原认证页面套件、真实中行凭证和完整构建待验收。

| 文件 | 行数变化 | 职责 |
| --- | ---: | --- |
| `tests/e2e/exchange-rate-boc.spec.ts` | 351 → 359 | 三场景调度、原页面与独立数据核对、单次测试截图 |
| `tests/e2e/helpers/boc-manual-rate-page.ts` | 155 → 151 | 接入同一专属环境和 SDK 校验，沿用 XTS 场景与回收 |
| `tests/e2e/helpers/boc-suite-guard.ts` | 新 123 | 实际项目与工作目录、共享 Edge 核验、原 SDK 地址校验 |
| `tests/e2e/helpers/boc-suite-fixture.ts` | 新 127 | 串行环境、真实请求回包关联、关闭和回收附件 |
| `tests/test-support/boc-quote-job-case.ts` | 新 344 | 六表空范围、归属与终态、按版本回收 |
| `scripts/learning/boc-quote-job-case.test.mjs` | 新 163 | 任务和报价凭证的拒绝边界 |
| `scripts/learning/exchange-rate-sync-cli.test.mjs` | 既有测试更新 | 共享校验的导入映射及配置错误脱敏 |
| 后端 `scripts/exchange-rate-sync-environment.mjs` | 196 → 93 | CLI 专属 SQL 和本次在途队列 |
| 后端 `scripts/exchange-rate-sync-edge.mjs` | 新 161 | 实际函数配置、模拟来源、挂载源码 |

Web 质量门禁采用 Non-rendered 路径。改动涉及测试和维护脚本，原场景的页面动作、认证调用和生产业务逻辑沿用。六项新回归、定向 ESLint、三个实际安全类型根、九根局部类型检查和原场景 AST 对照通过。局部类型使用原认证与提供器的声明边界。原产品页面的 1440px、390px 和双语验收本批未执行，截图路径通过静态核对。两仓库 README 和[测试维护指南](../explanation/exchange-rate-boc-tests.md)已更新。

汇率来源、CLI 和任务组合的首次回归有一项失败，原测试的合成模块加载表缺少新提取的校验模块。补齐映射后继续执行真实校验源码，并覆盖损坏配置错误脱敏。重跑 18 项通过，失败与重跑日志均保留。

隔离 PostgreSQL 使用当前结构、无网络、无端口和 tmpfs。正式 `service_role` RPC 保存 USD 报价 `984f3f9a-d764-4cb8-bb1c-10553f678f81`，任务 `5739b975-fc53-443a-908a-f53d863597f1` 达到 `succeeded`。同一报价再次保存返回同一编号且无更新。第二次任务 `dece301a-2f8d-46d5-a996-2a5bf7891732` 达到 `skipped`。按编号回收 1 条报价、2 个任务、2 条尝试、4 条合成核验类型行，独立核对六表恢复为空。33 次夹具 SQL 期间用 168 表的完整记录及版本摘要核对副作用。未知在途任务、外部 SET NULL 引用、零影响和提交回包丢失均保留独立凭证。四条核验记录仅来自隔离模拟。

真实 Chrome 通过两个回环 HTTP 服务核对 POST 请求及原始 202 状态、响应头和正文。浏览器收到回包前登记编号，两场景分别关闭后查证，最后回收并生成附件。前几次探针用匿名编译模块加载，运行器显示通过，但检查点表明未执行完整，日志保留且不计为通过。改用实际文件位置加载后，两个场景均有执行记录及附件。数据库端口在该探针中为模拟。Edge 校验另通过 17 份实际仓库源码和合成容器元数据核对，8 项错误输入拒绝。

完整日志、原文件备份和验证凭证保存在 Web `output/learning-boc-suite-20261111/` 及 `output/test-runs/`。隔离数据库、临时 HTTP 服务和重复结构备份已回收。主库复查为调度暂停、活动任务 0、请求队列 0、历史任务 269。上传、Cloud 写入、部署和真实中行核对本批未执行。
