# 审核中心

管理员从 `/admin/reviews` 打开审核中心。资料修改、隐私资料与媒体各有待审集合。普通工作台不能进入管理员入口。媒体签名链接只在授权读取后生成。

| 维护任务 | 阅读入口 |
| --- | --- |
| 找到权限检查与三类首屏数据 | [工作台审核入口](../../../app/%28workspace%29/%5Bworkspace%5D/reviews/page.tsx)、[审核读取](../../../lib/admin-reviews.ts) |
| 修改审核列表、预览与状态提示 | [页面组装](../../../components/dashboard/admin-reviews/admin-reviews-client.tsx)、[隐私列表](../../../components/dashboard/admin-reviews/admin-reviews-ui.tsx)、[媒体列表](../../../components/dashboard/admin-reviews/media-review-list.tsx)、[媒体预览](../../../components/dashboard/admin-reviews/admin-review-media-preview.tsx) |
| 核对审核写入或零行处理 | [确认及同一行锁](../../../components/dashboard/admin-reviews/use-admin-review-actions.ts)、[媒体与隐私回执](../../../lib/admin-review-mutations.ts)、[资料修改服务](../../../lib/profile-change-requests.ts) |
| 处理审核和列表刷新交错 | [审核页面状态](../../../components/dashboard/admin-reviews/use-admin-reviews-page.ts)。终态确认后移除原行，之前发出的旧列表请求不能覆盖新状态。 |

媒体与隐私只处理待审记录。审核页先读取当前账号，随后按记录编号独立核对申请人、决定、审核人和时间。空回执或确认失败时保留卡片。连接丢失时只查询原记录，查到目标终态才更新列表。资料修改沿用原申请编号及状态回执。

媒体后台审核与管理员人工决定是两条路径。签名链接用于预览，媒体对象是否存在需要单独通过 Storage 核对。拒绝隐私资料不会写入用户已通过的隐私资料。

后台图片的数据库认领与停用旅游的历史权限可按[审核SQL维护](../../../../PT5-dropshipping-supabase/docs/onboarding/review-sql-tests.md)验证。先确认七岗位和完整待审历史存在，再切换实际后台角色认领、独立读取审核行并验证浏览器角色拒绝；顺序SQL认领不代表真实双Worker并发、页面或Storage验收。

员工从个人页提交证件，先生成一条待审申请。普通会话只能新增待审记录，且隐私申请的审核人和时间必须为空。正式隐私资料由管理员审核流程写入。媒体后台登记使用服务端身份，用户直接登记时也要符合初始待审状态。[数据库权限与验证](../../../../PT5-dropshipping-supabase/docs/onboarding/database.md#审核中心与人工审核凭证)

- `npm run test:learning:browser -- admin-review-receipts profile-maintenance` 使用专属本机管理员和员工，覆盖空回执、真实通过或拒绝、响应丢失、独立凭证和刷新。
- 原审核中心端到端测试按[测试准入](../../real-e2e-blockers.md)执行。
