# 个人中心、账号切换与媒体

当前范围：共享。

## 业务与阅读顺序

维护本人资料、隐私申请、账号切换及需要审核的图片视频。

数据流：my/page → getCurrentUserBundle 的身份上下文和五类本人读取 → use-dashboard-my-bundle → 展示模型与领域动作 → 管理员直接保存/员工资料申请/隐私申请/媒体 Edge → 数据库与 Storage → 审核与刷新。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

页面沿用工作台准入，数据库和 Edge 再核对当前身份及岗位；员工修改资料生成申请，管理员确认后更新。账号切换须核验目标会话，本地显示信息不能授予权限。

完成依据：本人资料精确读回、申请编号及审核人/终态；媒体对象哈希、唯一登记、审核运行及删除后精确 LIST 一致。已入审核不等于已批准。

## 常见维护

先读 explanation/profile-data-flow.md。展示改 view-model/content，读取恢复改 bundle Hook，写入改各领域 Hook/服务；上传存储补偿与审核派发在后端独立文件。邀请读取失败与成功的空权限集合分开。

验证入口：npm run test:learning:browser -- profile-maintenance.spec.ts profile-invite-read.spec.ts profile-media.spec.ts；npm run test:operation-receipts；后端 user_media_upload_boundaries.test.mjs 与 user_media_storage_receipts.test.mjs。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`approve_profile_change_request`、`claim_user_media_image_review_attempt`、`get_current_salesman_business_boards`、`reject_profile_change_request`、`request_user_media_image_review`、`submit_profile_change_request`。

源码中直接引用的数据表/存储桶：`internal_job_request_secrets`、`pending_user_profile_change_requests`、`user_media_assets`、`user_media_image_ai_reviews`、`user_privacy_data`、`user_privacy_requests`、`user_profiles`、`user_vip_membership`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/learning/user-media-operation-verifier.test.mjs](../../../scripts/learning/user-media-operation-verifier.test.mjs)
- [web: scripts/learning/user-media-owned-case.test.mjs](../../../scripts/learning/user-media-owned-case.test.mjs)
- [web: scripts/profile-operation-receipts.test.mjs](../../../scripts/profile-operation-receipts.test.mjs)
- [web: scripts/user-media-preview-cache.test.mjs](../../../scripts/user-media-preview-cache.test.mjs)
- [web: tests/e2e/account-switcher.spec.ts](../../../tests/e2e/account-switcher.spec.ts)
- [web: tests/e2e/helpers/account-switcher-storage.ts](../../../tests/e2e/helpers/account-switcher-storage.ts)
- [web: tests/e2e/helpers/account-switcher-ui.ts](../../../tests/e2e/helpers/account-switcher-ui.ts)
- [web: tests/e2e/helpers/user-media-operation-verifier.ts](../../../tests/e2e/helpers/user-media-operation-verifier.ts)
- [web: tests/e2e/helpers/user-media-owned-store.ts](../../../tests/e2e/helpers/user-media-owned-store.ts)
- [web: tests/e2e/profile-operation-receipts.spec.ts](../../../tests/e2e/profile-operation-receipts.spec.ts)
- [web: tests/e2e/user-media-operation-receipts.spec.ts](../../../tests/e2e/user-media-operation-receipts.spec.ts)
- [web: tests/test-support/user-media-owned-case.ts](../../../tests/test-support/user-media-owned-case.ts)
- [supabase: supabase/tests/user_media_image_review_claim.sql](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_image_review_claim.sql)
- [supabase: supabase/tests/user_media_image_review_provider.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_image_review_provider.test.mjs)
- [supabase: supabase/tests/user_media_image_review_retry.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_image_review_retry.test.mjs)
- [supabase: supabase/tests/user_media_storage_receipts.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_storage_receipts.test.mjs)
- [supabase: supabase/tests/user_media_upload_boundaries.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_upload_boundaries.test.mjs)
- [supabase: supabase/tests/user_media_upload_policy.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_upload_policy.test.mjs)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(workspace)/[workspace]/my/page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/my/page.tsx) | 已审保留：岗位个人中心服务端组装 |
| [components/dashboard/admin-reviews/profile-change-review-list.tsx](../../../components/dashboard/admin-reviews/profile-change-review-list.tsx) | 已审保留：资料审核列表与空态展示 |
| [components/dashboard/dashboard-profile-cards.tsx](../../../components/dashboard/dashboard-profile-cards.tsx) | 已审保留：个人资料字段与状态展示 |
| [components/dashboard/dashboard-shared-my/dashboard-account-center-section.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-account-center-section.tsx) | 已审保留：账号字段与操作入口展示 |
| [components/dashboard/dashboard-shared-my/dashboard-account-switcher-confirm-dialog.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-account-switcher-confirm-dialog.tsx) | 已审保留：移除备用账号确认展示 |
| [components/dashboard/dashboard-shared-my/dashboard-account-switcher-section.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-account-switcher-section.tsx) | 已审保留：备用账号卡片与添加/切换入口展示 |
| [components/dashboard/dashboard-shared-my/dashboard-business-referral-panel.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-business-referral-panel.tsx) | 已审拆分：业务邀请链接展示；复制反馈 |
| [components/dashboard/dashboard-shared-my/dashboard-my-content-sections.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-my-content-sections.tsx) | 已审保留：本人资料与认证卡片展示 |
| [components/dashboard/dashboard-shared-my/dashboard-my-section-ui.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-my-section-ui.tsx) | 已审保留：资料区块与字段基础展示 |
| [components/dashboard/dashboard-shared-my/dashboard-shared-my-client.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-shared-my-client.tsx) | 已审保留：个人中心页面组装 |
| [components/dashboard/dashboard-shared-my/dashboard-shared-my-copy.ts](../../../components/dashboard/dashboard-shared-my/dashboard-shared-my-copy.ts) | 已审保留：个人中心文案合同与读取 |
| [components/dashboard/dashboard-shared-my/dashboard-shared-my-dialogs.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-shared-my-dialogs.tsx) | 已审拆分：证件/媒体弹窗调度；本人资料表单展示 |
| [components/dashboard/dashboard-shared-my/dashboard-shared-my-media-content.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-shared-my-media-content.tsx) | 已审拆分：照片与视频记录展示 |
| [components/dashboard/dashboard-shared-my/dashboard-shared-my-media-dialog-actions.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-shared-my-media-dialog-actions.tsx) | 已审保留：媒体弹窗底栏展示 |
| [components/dashboard/dashboard-shared-my/dashboard-shared-my-privacy-content.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-shared-my-privacy-content.tsx) | 已审拆分：证件空态/待审/通过展示 |
| [components/dashboard/dashboard-shared-my/dashboard-shared-my-refresh.ts](../../../components/dashboard/dashboard-shared-my/dashboard-shared-my-refresh.ts) | 已审保留：本人资料刷新与反馈路由 |
| [components/dashboard/dashboard-shared-my/dashboard-shared-my-sections.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-shared-my-sections.tsx) | 已审保留：个人中心内容区块编排 |
| [components/dashboard/dashboard-shared-my/dashboard-shared-my-state-copy.ts](../../../components/dashboard/dashboard-shared-my/dashboard-shared-my-state-copy.ts) | 已审保留：动作反馈与共享消息适配 |
| [components/dashboard/dashboard-shared-my/dashboard-shared-my-view-model.tsx](../../../components/dashboard/dashboard-shared-my/dashboard-shared-my-view-model.tsx) | 已审保留：本人数据展示推导；弹窗说明选择 |
| [components/dashboard/dashboard-shared-my/use-dashboard-account-switcher.ts](../../../components/dashboard/dashboard-shared-my/use-dashboard-account-switcher.ts) | 已审保留：账号切换交互调度；本地移除确认状态 |
| [components/dashboard/dashboard-shared-my/use-dashboard-business-referrals.ts](../../../components/dashboard/dashboard-shared-my/use-dashboard-business-referrals.ts) | 已审拆分：本人业务邀请读取与重试 |
| [components/dashboard/dashboard-shared-my/use-dashboard-invite-code.ts](../../../components/dashboard/dashboard-shared-my/use-dashboard-invite-code.ts) | 已审保留：本人邀请码复制反馈 |
| [components/dashboard/dashboard-shared-my/use-dashboard-my-bundle.ts](../../../components/dashboard/dashboard-shared-my/use-dashboard-my-bundle.ts) | 已审拆分：本人资料读取生命周期；恢复与写后刷新调度 |
| [components/dashboard/dashboard-shared-my/use-dashboard-password-reset.ts](../../../components/dashboard/dashboard-shared-my/use-dashboard-password-reset.ts) | 已审保留：重置邮件请求与冷却状态 |
| [components/dashboard/dashboard-shared-my/use-dashboard-profile-dialog.ts](../../../components/dashboard/dashboard-shared-my/use-dashboard-profile-dialog.ts) | 已审保留：本人资料草稿；资料保存调度 |
| [components/dashboard/dashboard-shared-my/use-dashboard-shared-my-media-actions.ts](../../../components/dashboard/dashboard-shared-my/use-dashboard-shared-my-media-actions.ts) | 已审保留：媒体上传意图与重试；媒体删除调度 |
| [components/dashboard/dashboard-shared-my/use-dashboard-shared-my-privacy-actions.ts](../../../components/dashboard/dashboard-shared-my/use-dashboard-shared-my-privacy-actions.ts) | 已审保留：本人证件申请提交调度 |
| [components/dashboard/dashboard-shared-my/use-dashboard-shared-my-state.tsx](../../../components/dashboard/dashboard-shared-my/use-dashboard-shared-my-state.tsx) | 已审拆分：组合领域动作与展示模型；证件草稿与弹窗意图 |
| [components/dashboard/dashboard-shared-photo-stack-preview.tsx](../../../components/dashboard/dashboard-shared-photo-stack-preview.tsx) | 已审保留：照片堆叠预览展示 |
| [lib/account-switcher-actions.ts](../../../lib/account-switcher-actions.ts) | 已审保留：账号添加/重认/切换领域动作 |
| [lib/account-switcher-storage.ts](../../../lib/account-switcher-storage.ts) | 已审保留：备用账号本地存储；临时登录意图存储；数据形状与期限校验 |
| [lib/account-switcher.ts](../../../lib/account-switcher.ts) | 已审保留：账号会话快照与恢复；临时登录意图协调 |
| [lib/profile-change-requests.ts](../../../lib/profile-change-requests.ts) | 已审保留：本人资料写入；资料申请与审核服务 |
| [lib/profile-operation-receipts.ts](../../../lib/profile-operation-receipts.ts) | 已审保留：资料与申请写入凭证断言 |
| [lib/user-media-mutations.ts](../../../lib/user-media-mutations.ts) | 已审保留：媒体请求协议；运行及资产结果校验 |
| [lib/user-media-preview-cache.ts](../../../lib/user-media-preview-cache.ts) | 已审保留：私有媒体签名缓存与并发合并 |
| [lib/user-privacy-requests.ts](../../../lib/user-privacy-requests.ts) | 已审保留：本人隐私申请创建 |
| [lib/user-profile-service.ts](../../../lib/user-profile-service.ts) | 已审保留：本人城市写入；空城市元数据同步 |
| [lib/user-self-service-types.ts](../../../lib/user-self-service-types.ts) | 已审保留：定义 PrivacyRequestStatus、MediaKind 等9项同模块类型合同 |
| [lib/user-self-service.ts](../../../lib/user-self-service.ts) | 已审保留：本人资料聚合读取；会话缓存重置；领域导出入口 |

### Supabase

| 文件 | 阅读重点 |
| --- | --- |
| [supabase/functions/user-media-cleanup/index.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-cleanup/index.ts) | 已审保留：后台请求鉴权；分批到期媒体清理；清理运行终态 |
| [supabase/functions/user-media-image-review/batch-outcome.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-image-review/batch-outcome.ts) | 已审保留：图片整批审核结果归并 |
| [supabase/functions/user-media-image-review/index.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-image-review/index.ts) | 已审保留：审核请求准入；逐图处理调度；整批运行归档 |
| [supabase/functions/user-media-image-review/provider.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-image-review/provider.ts) | 已审保留：供应商请求签名；图片传输；外部审核凭证解析 |
| [supabase/functions/user-media-image-review/repository.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-image-review/repository.ts) | 已审保留：待审与已完成资产读取；单图审核持久化 |
| [supabase/functions/user-media-image-review/types.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-image-review/types.ts) | 已审保留：定义 ReviewProvider、ReviewDecision 等4项同模块类型合同 |
| [supabase/functions/user-media-mutate/delete-handler.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-mutate/delete-handler.ts) | 已审保留：媒体删除请求准入；存储删除与补偿；数据库登记及运行归档 |
| [supabase/functions/user-media-mutate/index.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-mutate/index.ts) | 已审保留：媒体 HTTP 入口与动作分流 |
| [supabase/functions/user-media-mutate/shared.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-mutate/shared.ts) | 已审保留：媒体身份与岗位准入；对象读取及 HTTP 基础协议 |
| [supabase/functions/user-media-mutate/upload-handler.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-mutate/upload-handler.ts) | 已审拆分：上传输入准入；媒体登记事务协调；运行结果与失败补偿调度 |
| [supabase/functions/user-media-mutate/upload-policy.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-mutate/upload-policy.ts) | 已审保留：上传文件类型/大小规则；媒体路径生成 |
| [supabase/functions/user-media-mutate/upload-review.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-mutate/upload-review.ts) | 已审拆分：上传图片审核派发与记录核对 |
| [supabase/functions/user-media-mutate/upload-storage.ts](../../../../PT5-dropshipping-supabase/supabase/functions/user-media-mutate/upload-storage.ts) | 已审拆分：媒体对象上传及独立读回；本次对象失败补偿 |
