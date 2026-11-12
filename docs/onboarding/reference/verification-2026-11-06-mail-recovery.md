# Gmail 收件回补与 Watch 续订验证

2026-11-06。系统邮件 117 / 117、两仓库 1,001 / 1,745 份已有有效职责记录。整体状态为 `partial_failed`。[职责覆盖](manual-review-coverage.md)

## 缺陷与维护位置

历史游标过期后，旧流程只读一次邮件列表。若邮箱从未同步，还会从触发事件的发布时间开始，跳过此前已进入邮箱的邮件。Watch 续订也会把供应商给出的邮箱当前位置写成收件游标，跳过尚未处理的历史。Gmail 文档定义了过期游标的 404 和列表的分页令牌。[Gmail 历史](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list) · [Gmail 列表](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list)

回补从启用时间与最近成功同步时间两者中较晚的位置开始，从未成功同步时使用启用时间。读完所有分页并按消息编号去重后才开始处理。分页和单封处理失败会使事件重试，原游标保留。Watch 续订验证有效期，保持原收件游标。三个入口仍分别负责 Gmail 读取（64 行）、事件调度（186 行）和周期维护（126 行）。两仓库指南与测试入口已更新。[邮件维护入口](../explanation/mail-thread-flow.md)

## 验证证据

- 同一组初始回归在修复前有 4 项失败，日志 `2026-11-05T18-07-02-677Z-4fb53edb-ba4d-450d-aa6f-f63795b43ec9`。最终 `npm run test:mail-inbound-recovery` 的 5 项通过，覆盖多页去重、下一页失败与重复令牌、单封归档失败后重试、Watch 游标保留和无效期限。日志 `2026-11-05T18-11-40-172Z-befa3e8e-862a-461c-a920-35c733598a85`。
- 独立 Docker 实例使用 PostgREST 14.5 和临时 PostgreSQL 16，从本地 PostgreSQL 17 只读提取 11 张相关表结构以及领取、忽略来信两个函数。只写合成数据。实际 worker、Gmail 适配器、领取函数和陌生来信处理均运行，Gmail HTTP 响应由本地替换。该场景从后台事件触发。
- 事件 `24976ea9-5b49-4c50-bec2-d71878ae39c0`。续订得到供应商位置 200，原游标仍为 90。第二页 503 后，独立 SQL 查到 `failed`、游标 90、上次同步时间为空及零条回补审计。重试读完两页后，事件 `completed`、游标 130、两条不同消息的陌生来信凭证、零条正文归档，回补审计 3 记录候选数量为 2。日志 `2026-11-05T18-11-07-287Z-efb396b0-af0a-496f-b634-2b93ee0a45ff`，凭证在 `output/learning-2026-11-06/mail-recovery-docker/recovery-receipt.json`。
- 类型、lint、双语、工作台结构、操作契约、收件规则和发件对账通过。生产构建日志 `2026-11-05T18-09-31-217Z-2bc6bf2f-acfc-4376-a623-309a114cd55c`。临时数据库、REST 服务、网络与运行脚本已清理，共享本地项目的计划任务、外部请求队列及合成邮箱记录均为零。
- 学习地图通过。严格职责检查报告 744 份待审或受阻，日志 `2026-11-05T18-15-02-352Z-325bc8b5-b042-4fc9-ae3f-a940ac194627`。

后续[收件事务验证](verification-2026-11-06-mail-atomic.md)覆盖数据库并发推进和最后写入失败回滚。真实 Gmail 推送验签与重度积压仍需专项验证。
