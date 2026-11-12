# 共享读取与请求边界

## 先确认页面取的是整组数据还是一页

| 使用场景 | 从哪里读代码 | 修改时核对什么 |
| --- | --- | --- |
| 一次取完可见候选项，例如人员目录或 VIP 关联项 | [dashboard-complete-query.ts](../../../lib/dashboard-complete-query.ts) 每批最多取 500 条，直到末批 | 由业务查询决定筛选和权限。最后一个排序字段应唯一，避免等值数据在不同批次之间移动。读取中途返回错误时，已有批次不会作为完整结果交给页面。 |
| 前端已经拥有整组数据，例如部分提成展示列表 | [use-dashboard-pagination.ts](../../../lib/use-dashboard-pagination.ts) 调用纯分页函数切片 | 筛选键变化时回到第一页。显示总数来自传入数组。 |
| 数据量大，服务端每次只读一页，例如批发订单、物流和邮件收件 | [use-dashboard-query-page.ts](../../../lib/use-dashboard-query-page.ts) 管理页码、读取和重试 | 筛选变更先清空旧结果。请求编号阻止旧读取覆盖新状态。删除末页最后一条后会按总数回读有效页。 |

## 页面恢复有不同用途

- 工作台的 [WorkspaceSessionProvider](../../../components/dashboard/workspace-session-provider.tsx) 在切回长期隐藏页面、网络恢复等时机触发恢复。恢复会清会话快取并递增同步代次，子模块据此重新读取。
- [use-stale-focus-recovery.ts](../../../lib/use-stale-focus-recovery.ts) 给语言切换和导航一个一次性的整页重读信号。导航方决定是否使用它。
- [page-visibility.ts](../../../lib/page-visibility.ts) 支持等待页面重新可见和按前台停留时间计时。[request-timeout.ts](../../../lib/request-timeout.ts) 在超过等待时间时返回可识别的错误。原读取是否取消由调用方管理。

## 服务端收到请求之后

1. 登录确认、退出和邮件连接使用 [public-site-origin.ts](../../../lib/public-site-origin.ts) 选择回跳来源。生产用已校验的配置值，开发允许两个明确的本机名称。
2. 助手对话、订单评估与邮件接口使用 [server-request-body.ts](../../../lib/server-request-body.ts) 按 UTF-8 字节限制输入。声明值可用于提前拒绝，实际字节仍需逐批检查。确认超限后立即交给路由映射为 413。
3. AI 请求的并发名额来自 [api-request-quota.ts](../../../lib/api-request-quota.ts) 调用的数据库函数。路由须先完成自己的认证与业务权限检查，再按返回的租约在流程结束后释放名额。数据库过期规则负责进程异常退出后的回收。

检查边界可运行 `npm run test:public-site-origin`、`npm run test:server-request-body` 和 `npm run typecheck`。改分页或恢复逻辑时，还要打开调用页面验证空列表、重试和刷新。
