# 个人媒体回执测试怎样维护

先读[个人中心数据流](profile-data-flow.md)。原两个场景仍使用原运营登录和管理员客户端；本页解释数据凭证与失败收尾，人工审核业务另验。

| 修改任务 | 入口 |
| --- | --- |
| 上传重试、伪删除、刷新及390px | [原页面入口](../../../tests/e2e/user-media-operation-receipts.spec.ts) |
| UUID意图、完整记录、对象内容与清理阶段 | [媒体核心](../../../tests/test-support/user-media-owned-case.ts) |
| 专属SQL、下载/LIST/API删除与版本回收 | [实际数据能力](../../../tests/e2e/helpers/user-media-owned-store.ts) |
| 原运营下独立读取运行及撤销自身会话 | [运行验证器](../../../tests/e2e/helpers/user-media-operation-verifier.ts) |
| 离线失败回归 | [14项媒体](../../../scripts/learning/user-media-owned-case.test.mjs)、[6项运行验证](../../../scripts/learning/user-media-operation-verifier.test.mjs) |

上传前登记`user-media-receipt-UUID.png`、68字节原Tiny PNG及SHA。原登录返回的邮箱只用于在专属库解析稳定运营编号；SDK地址必须匹配显式专属API。SQL执行器核对DB/Kong、端口网络与off/0/0，不混用另一个项目。原账号、登录、管理员和配置import以及缺管理员skip保持，访问限制没有解除。

独立查询同时按文件意图、已见媒体/对象/评估编号和路径找记录，改名或重关联也会被发现。媒体和评估保留完整行与xmin；对象保留稳定编号、内容version和元数据，并下载核对大小/SHA。评估queued/processing时最多等30秒，failed不算正向核对通过；completed还须有效时间及manual_review/auto_pass决定。评估完成不等于人工审核通过。

伪删除只拦截本次一张图片；失败反馈之外，完整数据图必须不变。真实删除后查媒体、评估、对象均0，成功完整的Storage LIST也找不到原路径，再按原运营连接读取公开运行凭证并刷新。OPTIONS不占重试计数，413/伪200显式允许跨域，避免把CORS失败当作业务拒绝。

失败收尾先排空请求并关闭页面。即使首次receipt读取失败，也能按独占意图找到已落库媒体或孤立对象。陌生身份、SHA不符、对象内容版本/媒体/评估行版本变化或评估处理中均停止。凭证返回副本，调用方改返回值不能改清理基准。

对象只经Storage API删除，成功LIST和目录独立确认消失；不以SQL删storage表。随后锁内比对完整媒体/评估行与xmin，拒绝未知子表，媒体DELETE须实际1行，再独立查三类均0。孤立对象明确记录资产0/对象1。Storage和数据库分步完成：前步已完成而后步0行、版本冲突或丢回包时，保存阶段和剩余记录，仍为未完成，不盲目重试。该助手只用于可销毁隔离项目，不能宣称跨系统原子回滚。[官方Storage删除](https://supabase.com/docs/guides/storage/management/delete-objects.md)

运行验证器保留原凭据提供器、登录参数与`get_operation_run`，核对同一编号、实际数量、Storage确认及有效完成时间。finally使用`signOut({scope:'local'})`只撤销本验证连接，正文与撤销同时失败则保留两项错误；默认全局撤销会影响浏览器。[官方撤销范围](https://supabase.com/docs/reference/javascript/auth-signout)

执行`node --experimental-strip-types --test scripts/learning/user-media-owned-case.test.mjs scripts/learning/user-media-operation-verifier.test.mjs`可跑20项内存专项；真实Auth/REST/Storage/SQL、Chrome协议及清理证据见[本批报告](../reference/verification-2026-11-11-user-media.md)。原Auth两个产品页面、中英文、生产Edge上传/评估/删除未执行，既有[页面实操](profile-data-flow.md#自己验证一次)单独保留。
