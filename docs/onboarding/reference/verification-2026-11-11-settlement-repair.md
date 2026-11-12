# 结汇精确补价测试收尾

原结汇补价入口的源码审查已完成，保留两个场景、原管理员登录和页面写入。改造移除固定 54321 端口、共享任务地址切换及按日期预删报价。真实场景从专属项目的前一上海自然日发起，外部报价采用本机样本。失败场景拦截本次收款的三条调用。原页面套件和真实供应商仍待验收，整体为 `partial_failed`。

| 文件 | 行数 | 职责 |
| --- | ---: | --- |
| `tests/e2e/settlement-rate-repair-receipts.spec.ts` | 382 → 105 | 两个页面场景及原行为断言 |
| `tests/e2e/helpers/settlement-repair-page.ts` | 新 307 | 环境和生命周期、页面动作、同编号回包和故障路由 |
| `tests/test-support/settlement-repair-case.ts` | 新 247 | 夹具阶段、独立版本核对、回收凭证 |
| `tests/test-support/settlement-repair-receipts.ts` | 新 213 | 订单与发布归属、精确任务及报价、实际分配 |
| `tests/test-support/settlement-repair-sql.ts` | 新 142 | 专属快照、准备及事务回收 |
| `scripts/learning/settlement-repair-receipts.test.mjs` | 新 216 | 正常与错误凭证的离线回归 |

Web 质量门禁采用 Non-rendered 路径，改动限于测试。定向 ESLint、四个实际安全类型根、五根局部声明类型及原场景入口核对通过。局部声明保留原登录签名。原产品页的双语和 1440px／390px 仍待验收。README、Web [结汇维护指南](../explanation/wholesale-settlement-release-flow.md)和后端历史阅读入口已同步。

隔离 PostgreSQL 执行 30 次夹具 SQL，按 168 表的内容和行版本比对。实际发布收款 `4eda2660-b6c1-432e-868a-2ef41a43caea`，同发布编号只生成一行。没有精确报价时第一次分配失败且原记录不变。管理员重复申请得到同一任务 `2e951388-2182-4809-a639-1c3cd894f640` 和传输编号 2。实际 pg_net 请求由本容器回环服务接收，核对 USD、2026-11-10、收款编号与 `settlement_repair`。

随后以实际 `service_role` 函数保存日末报价 `b88fa443-1214-45c6-bd8c-767ab732f968` 并结束任务。正式分配保存一条分配和一条订单结汇，均关联该报价。10 USD 以公司价 6.632307 结汇 66.32 元，修订 0 → 1。重复提交修订 0 被拒绝。客户身份申请补价、未补价时分配、未知 SET NULL 引用和未确认清理的重试均有拒绝记录。成功及缺价场景回收后恢复各自基线。

首次回收发现创建客户触发一个档案和根目录，原事务完整回滚。更新范围后，用第一次真实派发和行版本独立核对，再在原隔离实例回收已登记数据，并检查其他账号档案版本。第二次按完整 15 个范围重新验证。回收时锁住目录树及已确认记录、校验未知外键和实际删除数，独立查空。故障场景保留到副本删除前复查。

五项离线回归通过。真实 Chrome 的两项本地协议探针确认同路径其他收款和 GET 响应会被忽略，模拟部分失败只匹配指定编号，其他任务轮询被阻止。第一次探针把 favicon 计入 RPC 请求数，修正探针统计后通过。本批 PostgreSQL 传输的 HTTP 接收器模拟 Edge，浏览器使用本地协议页。正式 Web、原 Auth、Edge 的联合运行，以及超时、中断和断线后的实际产品恢复仍待验证。

完整证据及回滚备份保存在 Web `output/learning-settlement-repair-20261111/` 和 `output/test-runs/`。隔离数据库、回环接收器和重复结构备份已清理。主库调度暂停、活动任务 0、队列 0、历史任务 269。上传、Cloud 写入和部署未执行。
