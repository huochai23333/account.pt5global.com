# 审核中心

当前范围：共享。

## 业务与阅读顺序

处理管理员可见的资料修改、隐私资料及媒体审核。

数据流：管理员审核入口 → 三类待审集合 → 同行确认与锁 → 审核回执及列表更新。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

管理员审核权限与用户本人申请能力分开；审核时重新确认当前目标状态。

完成依据：媒体和隐私读回原编号、目标状态、审核人和时间；资料修改核对原申请编号和状态。

## 常见维护

见[审核中心链路](../explanation/review-center-flow.md)。新增审核类型沿各自的列表、动作和回执服务维护。

验证入口：npm run test:learning:browser -- admin-review-receipts profile-maintenance；原审核套件按准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`approve_user_media_asset`、`approve_user_privacy_request`、`deny_user_media_asset`、`deny_user_privacy_request`。

源码中直接引用的数据表/存储桶：`pending_user_media_assets`、`pending_user_privacy_requests`、`user_media_assets`、`user_privacy_requests`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/e2e/review-center-entrypoint.spec.ts](../../../tests/e2e/review-center-entrypoint.spec.ts)
- [web: tests/learning/admin-review-receipts.spec.ts](../../../tests/learning/admin-review-receipts.spec.ts)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(workspace)/[workspace]/reviews/page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/reviews/page.tsx) | 已审保留：校验工作台入口；准备标题、语言及审核首屏数据 |
| [components/dashboard/admin-reviews/admin-review-media-preview.tsx](../../../components/dashboard/admin-reviews/admin-review-media-preview.tsx) | 已审拆分：呈现签名媒体缩略预览；维护图片和视频完整预览及不可用提示 |
| [components/dashboard/admin-reviews/admin-reviews-client.tsx](../../../components/dashboard/admin-reviews/admin-reviews-client.tsx) | 已审拆分：组装访问状态、页头和三类分页列表；挂载媒体预览弹窗 |
| [components/dashboard/admin-reviews/admin-reviews-shared-ui.tsx](../../../components/dashboard/admin-reviews/admin-reviews-shared-ui.tsx) | 已审保留：提供审核字段展示及姓名回退；呈现同一行的批准和拒绝动作 |
| [components/dashboard/admin-reviews/admin-reviews-ui.tsx](../../../components/dashboard/admin-reviews/admin-reviews-ui.tsx) | 已审拆分：展示隐私待审卡片、列头及空状态；把选中的行和操作交给调用方 |
| [components/dashboard/admin-reviews/media-review-list.tsx](../../../components/dashboard/admin-reviews/media-review-list.tsx) | 已审拆分：展示媒体待审记录及空态；映射后台识别状态并转发审核与预览 |
| [components/dashboard/admin-reviews/types.ts](../../../components/dashboard/admin-reviews/types.ts) | 已审保留：定义 ReviewTab、BusyAction 等2项同模块类型合同 |
| [components/dashboard/admin-reviews/use-admin-review-actions.ts](../../../components/dashboard/admin-reviews/use-admin-review-actions.ts) | 已审拆分：管理每条记录的确认与同步锁；分派三类审核及最终反馈 |
| [components/dashboard/admin-reviews/use-admin-reviews-page.ts](../../../components/dashboard/admin-reviews/use-admin-reviews-page.ts) | 已审拆分：管理当前标签和媒体预览选择；应用读取结果并忽略过期刷新；从列表移除已确认终态的原记录 |
| [lib/admin-review-mutations.ts](../../../lib/admin-review-mutations.ts) | 已审拆分：提交媒体或隐私审核决定；按原编号独立核对申请人、审核人、决定和时间 |
| [lib/admin-reviews.ts](../../../lib/admin-reviews.ts) | 已审拆分：验证审核读取会话；分批读取三类待审列表；按限制并发签发媒体预览链接 |
