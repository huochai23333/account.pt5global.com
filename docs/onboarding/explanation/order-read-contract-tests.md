# 订单读取测试：格式、日期与页面权限

先看测试实际调用了什么，不按所在目录判断范围。下面两份虽位于e2e目录，实际没有page/browser或认证辅助，直接调用生产纯逻辑并在内存里接管数据库请求。permissions文件则真正需要登录页面，仍受原认证入口限制。

| 文件 | 维护入口与成功凭证 |
| --- | --- |
| [订单关联选项](../../../tests/e2e/wholesale-order-link-options.spec.ts) | 调用[显示和排序函数](../../../components/dashboard/wholesale/wholesale-order-link-options.ts)，核对订单号/原币金额、同时间按ID倒序及原数组未被修改；2项 |
| [日期调用参数](../../../tests/e2e/wholesale-order-date-client.spec.ts) | 调用真实订单分页、评估校验及物流分页；内存客户端只记录请求名/参数，独立固定上海日期和月份预期；3项 |
| [页面权限](../../../tests/e2e/permissions.spec.ts) | 原12项检查工作台越权、旅游停用、财务批发准入及拒绝后返回本人首页；依赖原Auth，仍未执行 |

## 怎样改格式或日期

显示文案从wholesale-order-link-options走到wholesale-display.formatCurrency，保留订单原币，不混用人民币折算。排序先复制数组，按ordered_at倒序，再按ID倒序；添加选项字段应先核对传入类型和所有使用方，而不是在测试里写一份新排序。

日期由[order-date-range](../../../lib/order-date-range.ts)统一使用Asia/Shanghai的自然日。最近30天包括今天，所以起点减29天；下单日期范围与orderMonth是两种筛选。日期用例冻结在上海2026-01-01 00:30，独立预期2025-12-03至2026-01-01。每例结束恢复Date，不修改运行机器的时钟或项目日期规则。exact_all_time保留明确搜索模式与去除两端空白后的编号；不能把日期调用参数正确当作数据库已返回正确记录。

## 怎样运行原五项纯逻辑

从Web根目录执行。显式文件参数在加载测试前筛选，只加载这两份原测试及其已核对的生产运行时依赖；不使用认证替代入口。关闭Web启动，复用现有项目且不需要启动浏览器。唯一输出目录保留本次证据，不覆盖旧报告。

```powershell
$env:PLAYWRIGHT_SKIP_WEB_SERVER = "1"
$orderProof = "output/order-pure-" + [guid]::NewGuid().ToString("N")
node scripts/record-test-run.mjs -- node node_modules/@playwright/test/cli.js test tests/e2e/wholesale-order-link-options.spec.ts tests/e2e/wholesale-order-date-client.spec.ts --reporter=list --output=$orderProof
```

预期原5项通过，无登录、数据库连接或业务写入。专项另在UTC、Asia/Shanghai、America/Los_Angeles三个宿主时区各运行同一五项；重复运行不增加独立用例数。若改动新增真实查询或登录依赖，应重新选择验证路径，不能继续沿用“纯逻辑”范围。

## 怎样判断页面权限

工作台由server-auth.requireWorkspaceAccess核对会话、有效角色和对应根路径，再读取实际启用业务。批发岗位能力见wholesale-role-permissions，入口显示不替代数据库RLS。费用页还核对pageVariants.companyExpenses；旅游停用页与越权页不是同一结果。permissions原用例覆盖这些页面表现，回到本人首页还检查会话没有被误退出。

这三份文件职责清晰，保留原结构，补中文范围注释；编译移除注释后的原代码一致。原权限页面、完整E2E、当前数据库权限和真实业务写入仍分别验收。客户别名写入和清理由[独立专属夹具](customer-alias-tests.md)维护，与本页纯逻辑验证分开。[本批记录](../reference/verification-2026-11-06-wholesale-scope-contracts.md#2026-11-10订单读取原纯逻辑与页面权限源码)
