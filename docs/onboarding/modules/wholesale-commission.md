# 批发提成与推荐佣金

当前范围：启用。

## 业务与阅读顺序

在同一入口分别展示业务员提成与客户推荐佣金。

数据流：commission 标签 → board 权限 → 独立账目查询 → 共享客户查询 → 两类展示。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

客户只读取推荐佣金，不读取内部订单、员工资料和业务员提成。

完成依据：业务员提成结算独立读回编号、状态和结算时间；推荐佣金按关系与月份核对，缺价显示失败且不影响业务员提成。

## 常见维护

见[提成与佣金链路](../explanation/wholesale-commission-flow.md)。查询保留两类失败隔离，算法使用订单锁定的规则。

验证入口：npm run test:learning:browser -- wholesale-commission-settlement；后端 wholesale_customer_commission_and_fees.sql 隔离执行；原浏览器用例按准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`get_wholesale_referral_commission_rows`。

源码中直接引用的数据表/存储桶：`wholesale_commissions`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/learning/wholesale-fee-commission-fault.test.mjs](../../../scripts/learning/wholesale-fee-commission-fault.test.mjs)
- [web: tests/e2e/helpers/wholesale-fee-commission-fault.ts](../../../tests/e2e/helpers/wholesale-fee-commission-fault.ts)
- [web: tests/e2e/wholesale-commission-merge.spec.ts](../../../tests/e2e/wholesale-commission-merge.spec.ts)
- [web: tests/e2e/wholesale-customer-commission-fees.spec.ts](../../../tests/e2e/wholesale-customer-commission-fees.spec.ts)
- [web: tests/learning/wholesale-commission-settlement.spec.ts](../../../tests/learning/wholesale-commission-settlement.spec.ts)
- [supabase: supabase/tests/wholesale_customer_commission_and_fees.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_customer_commission_and_fees.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/dashboard/wholesale/use-wholesale-commission-board.ts](../../../components/dashboard/wholesale/use-wholesale-commission-board.ts) | 已审保留：同步当前标签和浏览器地址 |
| [components/dashboard/wholesale/use-wholesale-incentive-view-model.ts](../../../components/dashboard/wholesale/use-wholesale-incentive-view-model.ts) | 已审保留：维护提成筛选；计算提成列表的展示选项和汇总；按语言生成规则说明 |
| [components/dashboard/wholesale/use-wholesale-referral-commission-view-model.ts](../../../components/dashboard/wholesale/use-wholesale-referral-commission-view-model.ts) | 已审保留：维护推荐佣金筛选；汇总已读列表的佣金和运单数 |
| [components/dashboard/wholesale/wholesale-commission-page.tsx](../../../components/dashboard/wholesale/wholesale-commission-page.tsx) | 已审保留：组装服务端许可的两个标签；隔离展示每个标签的读取失败 |
| [components/dashboard/wholesale/wholesale-commission-records.tsx](../../../components/dashboard/wholesale/wholesale-commission-records.tsx) | 已审拆分：展示桌面表格和手机卡片；根据行状态渲染结算按钮 |
| [components/dashboard/wholesale/wholesale-commission-section.tsx](../../../components/dashboard/wholesale/wholesale-commission-section.tsx) | 已审保留：组装规则说明及提成摘要；连接筛选控件和独立视图模型；协调分页、空态与记录展示 |
| [components/dashboard/wholesale/wholesale-commission-settings.ts](../../../components/dashboard/wholesale/wholesale-commission-settings.ts) | 已审保留：把当前生效规则格式化为业务说明 |
| [components/dashboard/wholesale/wholesale-referral-commission-section.tsx](../../../components/dashboard/wholesale/wholesale-referral-commission-section.tsx) | 已审保留：展示推荐佣金汇总；连接搜索与客户筛选；呈现分页结果及金额明细 |
| [lib/wholesale-commission-boards.ts](../../../lib/wholesale-commission-boards.ts) | 已审保留：按岗位声明可用标签 |
| [lib/wholesale-commission-page.ts](../../../lib/wholesale-commission-page.ts) | 已审保留：编排两类账目的服务端查询；保留分标签的读取失败 |
| [lib/wholesale-commission-settlement.ts](../../../lib/wholesale-commission-settlement.ts) | 已审拆分：条件更新待结算提成；独立核对最终记录及本次时间 |
| [lib/wholesale-referral-commissions.ts](../../../lib/wholesale-referral-commissions.ts) | 已审保留：读取完整的可见推荐佣金集合；归一化 SQL 字段与可空金额 |
