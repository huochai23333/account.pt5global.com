# 个人中心的数据从哪里来

先看[个人中心模块表](../modules/profile.md)，再按这里的调用链阅读。`/admin/my`、`/salesman/my` 等岗位共用 `app/(workspace)/[workspace]/my/page.tsx`，工作台布局核验入口权限。页面只选择工作台、取得初始资料、下发三个文案命名空间并组装 Client。

## 首屏与刷新

`lib/user-self-service.ts#getCurrentUserBundle` 先取得当前身份上下文，再并行读本人 `user_profiles`、`user_privacy_data`、`user_privacy_requests`、最近的 `user_vip_membership` 和非拒绝的 `user_media_assets`。任一正式读取失败都会抛出，不能把失败变成“没有资料”。读取仍包含一项原有附加行为：当城市为空且满足当前角色/状态规则时，可从 Auth 中的城市补写；它不覆盖已经填写的城市，也不提供岗位授权。

`dashboard-shared-my-client.tsx` 只组装区块和弹窗。`use-dashboard-my-bundle.ts` 管理首次读取、会话恢复和写后刷新；`dashboard-shared-my-view-model.tsx` 把原始资料转换为显示姓名、认证状态和媒体分组；`use-dashboard-shared-my-state.tsx` 组合证件草稿、弹窗意图及各领域动作，不生成媒体操作区 JSX。迟到读取只在当前加载生命周期仍有效时回写。

## 姓名、城市和证件

点击“编辑个人资料”后，`use-dashboard-profile-dialog.ts` 管理草稿及提交调度；`lib/profile-change-requests.ts` 执行实际写入和返回凭证检查。

- 管理员保存本人姓名、城市：核对返回记录的用户编号与提交值，再刷新。写入已完成但刷新失败时显示等待刷新，不能说全部完成。
- 员工保存：`submit_profile_change_request` 建立申请，正式资料保持原值。管理员从审核中心调用批准函数后，申请的 `status`、`reviewer_user_id`、`reviewed_at` 与正式资料共同证明完成。
- 身份证、护照：草稿与动作在 `use-dashboard-shared-my-privacy-actions.ts`；展示在 `dashboard-shared-my-privacy-content.tsx`。`user_privacy_requests` 是申请，`user_privacy_data` 是已存资料，两者不能混同。

页面角色分支方便安排交互；数据库和 Edge 的当前身份检查才是最终写入边界。不要从姓名、邀请码或可编辑的 Auth 显示字段推断权限。

## 照片和视频

媒体展示在 `dashboard-shared-my-media-content.tsx`，底栏在 `dashboard-shared-my-media-dialog-actions.tsx`。动作 Hook 保存同一次上传的文件及防重复编号；页面丢失响应后，重试沿用原编号。

后端 `user-media-mutate/index.ts` 核验身份并分流：

1. `shared.ts` 核对当前账号与可执行岗位，`upload-policy.ts` 校验类型、大小和路径。
2. `upload-handler.ts` 创建防重复运行。重放已有意图时返回原凭证；新意图调用 `upload-storage.ts` 上传并用成功目录读取确认精确对象，然后登记 `user_media_assets`。
3. `upload-review.ts` 为图片请求审核并核对触发器建立的审核记录。视频不发图片审核。数量不一致须返回部分完成；已有待审记录但派发暂时失败沿用现有恢复机制。
4. 出错时按本次已记录的对象和资产编号补偿。删除请求成功后还需确认对象消失，不能直接认定清理完成。
5. `user-media-image-review` 读取待审对象、调用明确配置的供应商、持久化单图结论及整批运行凭证。`disabled` 表示本地转人工，不是 AI 自动批准。管理员从审核页确认通过后，资产才成为 `pass`。

完成验证要同时看到资产编号、文件字节/哈希、审核运行终态、批准人及刷新结果。删除还要看到资料为零、`storage.objects` 为零和成功 LIST 中精确对象不存在。后台运行保留审计凭证，不能用删掉凭证的方式清理测试。

同名文件与目录可能同时出现在 LIST 中，目录的 id=null 不能遮住后续文件。[对象凭证原理及调用方](../../../../PT5-dropshipping-supabase/docs/onboarding/storage-object-receipts.md)说明本次修复与核对。profile-media 的专属子对象在准备前记录路径，失败也准确回收；其清理另用独立 SQL/目录断言。控制台仅按已知受控断线与签名 503 分类，其余错误/警告会使验收失败，消息正文不写入报告。

## 账号切换、预览与邀请链接

`use-dashboard-account-switcher.ts` 调度操作，`lib/account-switcher.ts` 核验目标会话，`account-switcher-storage.ts` 维护一个备用账号。备用会话期限为 30 天，临时登录意图为 30 分钟；到期移除令牌并要求重新登录。存储的姓名、岗位、默认路径仅为显示与导航，不能作为授权凭证。

预览链接由 `user-media-preview-cache.ts` 按桶/对象缓存，并合并相同对象的并发请求。缓存清理时递增代次，清理前发出的签名不能回写，也不能删掉新一轮的请求。暂时签名失败不缓存，重新打开能再次读取。定向测试覆盖这两种情形；切换身份时是否在每条入口都正确清理仍需专项验收。

邀请面板的 `use-dashboard-business-referrals.ts` 严格读取本人当前业务。读取失败显示重试，成功的空集合才显示没有可用权限；重试不增加默认业务授权。

## 原资料回执测试怎样维护

[原个人资料回执场景](../../../tests/e2e/profile-operation-receipts.spec.ts)保留从页面提交、零行失败、真实提交但刷新失败、独立字段读回、重新打开与390px溢出检查。它使用固定管理员，`beforeEach`先核验专属DB/Kong/API、共同网络及`off|0|0`；原Auth/管理员入口仍受限，本轮没有加载或运行这个页面套件，前置通过不代表这些辅助实际指向同一项目。

恢复函数只负责本用例修改的姓名、城市：先按用户编号独立读取，已经是原值则不重复写；当前值不是本次UUID标记值就拒绝覆盖。UPDATE同时筛选用户编号、本次姓名与城市，防止读取后出现交错修改；必须精确影响1行并返回同一编号，再独立读取原值。SDK默认不返回修改行，需要显式select，参考[官方更新说明](https://supabase.com/docs/reference/javascript/update)。当前资料表没有修订列，这里核对的是字段归属，不声称获得完整版本锁。

最后先关闭本次页面，再尝试恢复。页面关闭失败仍继续恢复，主体与各项收尾错误均保留；恢复失败不能把原UI失败遮住。若在途服务提交尚未确认，或检测到别处新值，保留专属实例与错误并人工核对，不去掉条件强行恢复。完整中断/真实API锁等待仍需独立验收。

[资料回执单元测试](../../../scripts/profile-operation-receipts.test.mjs)保留13项生产回执对照，并在同文件增加7项当前恢复函数回归；它只抽取两个函数并使用已安装SDK、明确内存REST替身，不加载原Auth/管理员import。20项通过；另在无网络空PG17的最小字段模型，用实际SQL复现旧覆盖、条件零命中、原NULL恢复、重复不改写、缺凭证/读回失败和无关字段保护。65次SQL及实际finally三错误保留构成11组凭证，模型不等于真实Auth/RLS或完整PostgREST验收。详见[本批记录](../reference/verification-2026-11-06-receipt-test-review.md#2026-11-10原资料回执夹具恢复)。

## 自己验证一次

[原媒体回执测试维护](user-media-receipt-tests.md)说明原凭据入口、UUID文件意图、对象SHA/内容版本、完整媒体/评估行、local会话撤销和分阶段回收。真实SDK/SQL与Chrome协议独立记录，原两个产品页面仍未执行。

先按[本地启动](../how-to/local-development.md)和[验证前提](../how-to/verification.md)准备。使用项目声明的 npm，复用已有 Web 服务；媒体用例还需本地 Edge 运行且 `USER_MEDIA_IMAGE_REVIEW_PROVIDER=disabled`。

```powershell
npm run test:learning:browser -- profile-maintenance.spec.ts profile-invite-read.spec.ts profile-media.spec.ts --output=output/本次专属目录
npm run test:operation-receipts
npm run test:media-preview-cache
npm run check:edge
```

新套件只使用自己的账号和夹具，包含中英文、1440/390px、真实表单操作、独立数据库/Storage 读回、刷新和限定清理。它不加载受限的历史测试辅助入口，不代表原套件或真实图片供应商验收通过。失败原始日志与本地证据目录由[验证报告](../implementation-report.md)说明。
