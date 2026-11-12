# 操作凭证与运行账本

判断后台自动处理时，要同时看原请求编号、运行及尝试、计划任务实际执行时间、最终记录，而不是只手动调用函数。[订单评估自然到期](../reference/verification-2026-11-11-assessment-automatic.md)演示了期限前巡检不改变运行、期限后实际cron生成超时和告警，以及页面刷新后的筛选核对；只在专属可重建实例启用调度，主项目保持暂停。

线索同步、物流同步、媒体操作等通过运行账本追踪。请求编号只能说明已受理。后台按数据库分配的运行编号与尝试号开始、续期和完成，页面使用当前会话按原编号读回 `get_operation_run`。管理员与请求人有各自的数据库读取范围，权限校验不会因重试而跳过。

## 从页面读到终态

线索页由 `sales-lead-write.ts` 读取受理回执，`use-sales-leads-page.ts` 调用 `operation-runs.ts` 等待结果。读取结果须与本次运行编号一致，计数必须是数据库返回的非负整数。最后一次查询已到终态时按该状态展示，仍在处理时显示待确认。依赖完整成功的业务还调用 `requireSucceededOperationRun`，核对完成时间、失败数与预期成功数。业务记录、行版本和对象内容继续由对应模块核验。

Edge 的 `_shared/operation-run.ts` 使用当前尝试号记账。定时任务沿用派发时的编号，手动发起可创建运行；有幂等键的写入可识别重放。Node.js 路由的账本适配位于 `server-operation-runs.ts`。两边均使用服务端凭据，浏览器只读取被授权的结果。

后台自动流程可以这样阅读：小时任务创建运行并首次派发；分钟任务只处理已经到期的排队运行，继续使用原运行编号，新增尝试号和传输编号。来源部分失败时保留已经导入的数据与最早重试时间；暂停后恢复不应重新创建业务意图。[真实计时器验收](../reference/verification-2026-11-11-auto-dispatch.md)覆盖原小时触发、暂停越过到期和60／300秒后的实际Edge重试；外部来源为本机模拟，其他任务类型仍分别验收。

[后台账本历史阅读路线](../../../../PT5-dropshipping-supabase/docs/onboarding/operation-reimbursement-history.md)把运行、尝试、告警及业务请求分别说明。历史数据库队列中的请求正文只证明派发参数，合成 result_proof 不能作为 Storage、邮件或 AI 的业务成功凭证。

尝试号与重复投递的演进见[后台领取历史](../../../../PT5-dropshipping-supabase/docs/onboarding/worker-monthly-quotation-history.md)。运行编号和尝试号一起识别当前 Worker；旧代的心跳或完成不能用于新代。真实数据库锁竞争、HTTP 重复投递和供应商终态分别验证。

## 文件与管理员历史

`storage-operation-receipt-validation.ts` 区分删除前存在、删除后不存在、上传路径和数据库登记行。需要区分同名目录、对象及权限错误时，资料库还使用 `storage-operation-object-presence.ts` 逐页核对目录。`verified-action-outcome.ts` 区分已保存后的刷新失败和实际写入失败，避免重复提交。

管理员历史页的 `admin-operation-records.ts` 只汇总账号日志与已审核的资料请求。`admin-operation-records-mapping.ts` 把两种来源映射为同一格式，客户端从过滤后的结果分页。账号日志含当时的身份快照，资料审核通过用户编号补查当前姓名和邮箱。该页面属于停用旅游栏目，直接访问 `/admin/tourism/records` 仍显示停用说明。

本地运行 `npm run test:operation-receipts` 核对回执解析与拒绝场景。`npm run test:learning:browser -- operation-run-receipts workspace-notice` 验证真实线索页面、账本读回及停用入口。线索派发在浏览器中拦截，合成运行按专属编号清理。后台实际访问外部来源单独验收。
