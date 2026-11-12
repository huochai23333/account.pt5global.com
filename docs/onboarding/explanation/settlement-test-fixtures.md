# 结汇测试的数据与收尾

先区分测试范围：原Playwright结汇入口仍依赖受限认证辅助，本页不表示原页面套件已经运行。新增专项分别核对实际SQL内核、SDK正文解析和资源生命周期，三者有各自证据，不能相互替代。

## 从哪个文件开始

| 文件 | 维护内容 |
| --- | --- |
| [原共用辅助](../../../tests/e2e/helpers/wholesale-settlement-fixtures.ts) | 保留原调用签名，转交收款清理、准备/回收自有USD报价、读取有效分配合计 |
| [原缺价月度用例](../../../tests/e2e/wholesale-settlement-monthly-summary.spec.ts) | 两角色从页面发布/分配/清空，缺价状态及刷新；登记已创建页面并保留失败原因 |
| [原子SQL](../../../tests/test-support/settlement-fixture-cleanup-sql.ts) | 验证精确备注、锁定收款、三类删除与回执、提交后独立读取语句 |
| [专属目标接线](../../../tests/test-support/settlement-fixture-cleanup.ts) | 只读核对Web/API/DB项目映射、12秒语句/10秒锁/15秒进程期限、另连核对 |
| [专项回归](../../../scripts/learning/settlement-fixture-cleanup.test.mjs) | 合成进程边界、真实SDK配内存HTTP、抽取原声明的失败收尾；不加载原认证模块 |
| [未分配原场景](../../../tests/e2e/wholesale-settlement-monthly-unallocated.spec.ts) | 基线确认、页面发布/分配/清空/取消及调度；保留原金额预期 |
| [未分配数据准备](../../../tests/e2e/helpers/monthly-settlement-fixture.ts) | 本次UUID清单、上海业务日期、三岗位及客户/订单、四种收款样例和准确写入回执 |
| [跨角色卡片](../../../tests/e2e/helpers/monthly-settlement-cards.ts) | 原三岗位、双宽度、搜索/状态不改变汇总、管理员英文切换步骤 |
| [未分配收尾](../../../tests/test-support/monthly-settlement-lifecycle.ts) | 准备前/收尾前的专属目标核验、精确删表/独立计数、逐账号删除及独立查回 |
| [未分配专项](../../../scripts/learning/monthly-settlement-lifecycle.test.mjs) | 真实SDK配内存HTTP的写入/清理失败与抽取声明生命周期；不加载原认证模块 |

## 为什么三类记录要一起清理

收款删除时分配会级联删除，但订单结汇记录的source_settlement_release_id会变NULL。旧辅助先删收款、再发第二次请求删结汇；第二次请求失败后，重试已经无法按来源找到孤立结汇。真实项目结构副本已复现这一状态。

现在一个事务先FOR UPDATE锁定本次精确备注的收款，再删除分配、结汇、最后删除收款。有效分配必须关联结汇，所以分配先删；收款最后删，来源不会在重试前丢失。任一阶段失败、影响数不符或提交前连接中断都整次回滚。提交后丢失回执不会撤销已提交的删除，调用者仍须报失败，再次执行按精确备注核对现状。两个相同备注匹配多条收款时拒绝，不能借备注碰撞清理其他运行。

备注最多100个，空/控制字符拒绝，重复输入去重；查询始终精确匹配，不使用LIKE或前缀。输入放在DO之外的临时表中，引号、反斜杠与美元分隔符只作数据。回执包含实际收款/分配/结汇UUID及影响数；独立新连接再次按备注和这些主键核对三类记录均为0。

原子清理依赖显式的专属项目。运行原入口前须设置PLAYWRIGHT_BASE_URL、NEXT_PUBLIC_SUPABASE_URL、PT5_E2E_FIXTURE_MODE=disposable、PT5_E2E_DATABASE_PROJECT和PT5_E2E_DATABASE_CONTAINER。实际数据库与supabase_kong网关须同项目、同网络，API端口实际映射一致，并核对cron off、启用0、外部队列0。只声明“本地”或更改标签不能代替隔离。

原API/Auth客户端与上述目标的完整正向接线仍未执行；当前不能运行原受限入口。数据库内核验证使用无网络/tmpfs结构副本，准入接线的进程元数据在专项中明确模拟。

## 合计与页面生命周期

getActiveAllocationTotal只有真正空数组才返回0。HTTP成功但正文null不是“已清空”；有效行的金额必须为非空字符串或数字、有限且大于0，保持数据库正数合同。有效金额仍按原算法相加，没有改变生产金额规则。SDK内存HTTP已复现旧函数把null误作0，并验证新函数拒绝。

月度已分配按分配发生月统计，缺价看收款日的精确USD报价；不能与按received_on统计的“本月未分配”混用。原缺价用例寻找确实缺报价的过去业务日，不删除共享报价制造故障。USD准备/回收两个函数维持既有行为，只回收自己插入后保存的编号；这不是实际中行报价验收。

浏览器第二页构造失败也必须关闭第一页。页面一创建就登记，所有关闭和数据回收按顺序尝试；任何收尾失败都保留，且不得覆盖原业务断言错误。Playwright默认page/context生命周期与手动browser.newPage不同，手动创建的页面由用例自己回收。[Playwright夹具说明](https://playwright.dev/docs/test-fixtures)

## 如何验证

```powershell
node --test scripts/learning/settlement-fixture-cleanup.test.mjs scripts/learning/fixture-cleanup-sequence.test.mjs
```

专项17项加共用收尾4项共21项；范围是准入/进程、SDK内存HTTP、原声明的失败生命周期，不是原月度页面场景。完整学习工具还包括此前其他用例：

```powershell
npm run test:learning
npm run check:learning
```

实际数据库证据在本机output/learning-monthly-settlement-fixture-review-20261110：旧算法由实际SQL支持的诊断客户端执行；当前内核核对正常/重试、三个阶段故障、备注歧义、零影响、连接中断和真实锁竞争。外来样例完整行/版本和函数权限保持，最终专属实例回收。该目录为本地证据，不是新克隆的运行前提。

## 本月未分配场景怎样维护

原monthly-unallocated的准备、页面卡片和收尾已经分开，原实际页面场景仍未运行。先用显式专属目标通过实际DB/Kong核验，再生成UUID清单；准备三角色/客户/订单，确认页面基线确无本月余额后才插入四种收款。旧的共享余额不清空，基线不符时中止。按收款月统计，不依赖列表筛选，也不与按分配发生月的已分配卡片混用。

三岗位配置、客户和订单要求返回本次准确编号；四种收款要求四个不同编号和精确备注集合，只有HTTP成功不能继续。此处收款直接插入属于测试准备；待测发布、分配、清空和取消仍从原页面发起。原三份插入参数与三个页面片段、三角色卡片循环保持，未更改生产金额算法或权限。

收尾先逐页关闭，再次核验专属目标，按收款、订单、自有客户、注册关联客户、账号顺序尝试。一个资源失败仍尝试后续，主体与收尾错误同时保留。各表先读本次编号，删除回执集合必须一致，然后另请求确认原精确条件计数为0。账号删除必须返回同一用户，另一次getUserById明确404/user_not_found；403、仍存在或未知响应均报失败。该Auth合同由实际SDK加内存HTTP验证，真实Auth服务删除仍未执行。

```powershell
node --test scripts/learning/monthly-settlement-lifecycle.test.mjs
```

专项11项覆盖上海跨年月界、写入零行/缺回执、关闭及收款清理失败、零删除/未知计数/读取失败、Auth假成功及错误拒绝、目标不明时只关页面、主体错误保留。原声明只抽取执行到准备失败处，不能代替页面实跑。数据库诊断接线验证订单/客户真实删除与保护样例，Auth、真实PostgREST和默认准入正向API映射另验。

原完整E2E、真实Web/Auth、双语/宽度矩阵及中行报价继续分别登记。详见[验证报告](../reference/verification-2026-11-05-settlement-release-clear.md)和[原入口准入清单](../../real-e2e-blockers.md)。
