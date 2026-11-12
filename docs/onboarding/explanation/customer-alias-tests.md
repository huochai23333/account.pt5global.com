# 客户别名测试的数据归属与最终凭证

别名属于客户档案，旧别名必须保留；相同名称重复提交不新增条目，也不增加档案修订。生产页面由wholesale-customer-other-names组装输入，wholesale-customer-actions调用wholesale-customer-mutations，再由数据库append_wholesale_customer_other_names锁定最新客户并合并。数据库仍核对实际角色/档案权限，不用测试名称或客户端metadata授权。

## 从哪里修改

| 文件 | 负责什么 |
| --- | --- |
| [原页面场景](../../../tests/e2e/wholesale-customer-other-names.spec.ts) | 保留两个原场景；从页面创建本次客户、追加别名、刷新、重复提交和390px输入可用性 |
| [页面夹具接线](../../../tests/e2e/helpers/customer-alias-fixture.ts) | 实际专属项目核验、提供自有清单/读回方法、异常后的限定清理并保留主体错误 |
| [独立记录核对](../../../tests/test-support/customer-alias-records.ts) | UUID清单、精确归属/版本/名称集合、含原修订的七条件删除及两次独立零残留核对 |
| [SDK与接线专项](../../../scripts/learning/customer-alias-fixture.test.mjs) | 真实SDK配内存HTTP，缺正文/零删除/错误ID/残留/目标变化与实际夹具声明的收尾 |

## 怎样准备本次数据

原用例曾向固定Wholesale Alpha写入时间戳别名，不独立查表也不清理。现在每例提前生成UUID唯一名称、初始别名、新别名和精确备注；业务创建和追加都由原页面表单完成。页面首次保存后，另一个管理员客户端按唯一名称读取，核对备注、sales_created、未绑定注册账号、真实创建人UUID、名称集合与修订1，再固定记录ID。

两场景均要求可重建的专属Web/API/Auth/DB及原认证入口正式准入。PLAYWRIGHT_BASE_URL、NEXT_PUBLIC_SUPABASE_URL、PT5_E2E_FIXTURE_MODE=disposable、PT5_E2E_DATABASE_PROJECT、PT5_E2E_DATABASE_CONTAINER须与实际DB/Kong标签、网络和API端口吻合；准备及清理前均核对调度off/启用0/外部队列0。只声明本地不能放行。完整管理员客户端与页面/API的正向接线仍待执行，当前不能运行原受限场景。

## 成功和清理怎样判断

首次追加后独立读取同一ID、原别名和新别名各一次、修订2，然后刷新并重新打开客户。重复提交相同别名时，现有界面提示“客户资料中已有这些名称。”并保留输入；等待该提示后，独立记录仍为同一ID、同一集合和修订2。不能为了让测试通过改成表单自动关闭或修改金额/权限规则。

夹具显式依赖本次page，finally先关闭页面，再核验目标，按绑定ID或本次唯一名称读取并验证备注和档案归属。关闭失败仍继续独立清理；主体、关闭与数据清理错误都会保留。删除同时限制ID、唯一名称、备注、sales_created、未关联注册账号、原创建人及读取时修订七项，返回的实际编号必须恰好一条；读取后记录发生变更会删除零行并失败，不能清理刚更新的版本。再分别按ID、名称新请求查询，计数都为0才算完成。页面创建前失败只做精确零残留核对；已清理可再次核对。备注变化、同名换ID、错误回执、零影响或未知计数都会失败，不清理其他运行的记录。

## 怎样验证辅助边界

```powershell
node --test scripts/learning/customer-alias-fixture.test.mjs
```

17项覆盖UUID隔离、独立凭证、缺记录/错误版本、归属与ID变化、读取后的并发修订、精确删除及重试、零影响/错误回执、残留/未知计数、目标准入、同一清单ID绑定和失败收尾；包括先关页面的顺序、关闭失败继续清理及三错误保留。HTTP完全由内存接管、Docker元数据明确模拟，不登录真实Auth，不代表原页面通过。完整学习工具另运行npm run test:learning。普通客户管理的创建/编辑/删除也复用这份清单，不另造日期前缀清理。

本机隔离SQL诊断另执行真实authenticated管理员创建/追加函数，真实SDK经SQL诊断接线核对记录和清理。首次追加1→2，重复追加整行/xmin不变；零删除被拒绝且原行/版本保持；备注归属变化只读拒绝，恢复本次备注后回收。受控跨连接交错在读取后、删除前更新来源，真实修订升至2，旧修订删除零行且新内容保留；再次读取新版本后才能回收。该诊断不是双请求锁竞争、真实PostgREST或默认Web/API/Auth映射验收，不执行注册/推荐重复验证。

原页面套件、桌面/手机、中英文、加载/错误与真实权限仍独立未完成。[验证记录](../reference/verification-2026-11-05-wholesale-people.md#2026-11-10客户别名原测试与专属夹具) · [原入口限制](../../real-e2e-blockers.md)
