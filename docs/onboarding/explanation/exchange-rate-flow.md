# 汇率报价与同步链路

[历史报价与收款分配阅读](../../../../PT5-dropshipping-supabase/docs/onboarding/rate-publication-allocation-history.md)区分早期参考价、当前银行报价和相应测试名称；维护当前业务按下述链路定位。

从工作台侧栏的“汇率”进入当前岗位的 `/settings`。管理员可以维护和同步，已启用的内部账号可以查看，客户不能进入。工作台配置负责入口，`exchange-rates-page.ts` 根据实际账号状态准备管理或只读数据，数据库策略和 Edge 入口再核验对应权限。

[原展示权限测试](../../../tests/e2e/exchange-rate-visibility.spec.ts)按两层条件理解：`exchange-rate-permissions.ts`允许启用的内部岗位只读，而工作台还要求账号具有当前启用的业务。原种子中的管理员、运营、业务员和财务为有业务组；经理、推广员、招聘员为无可用业务组，不表示后三种岗位永远不能读取汇率。客户缺少settings页面能力且不在内部读取岗位集合。

该文件九个页面场景覆盖四岗位侧栏进入、财务手机导航、三岗位无业务拦截和客户拒绝；管理按钮隐藏仅是展示断言，不能替代API/RLS拒绝证明。本轮只完成完整源码、实际导航/守卫调用链和AST核对，原账号入口仍受限，九例均未执行；不能把既有财务独立学习用例扩展成这份原权限矩阵通过。

## 人工录入与编辑

`use-exchange-rates-view-model.ts` 组合目录、筛选与编辑器。人工输入由 `use-exchange-rate-manual-editor.ts` 处理，写入在 `exchange-rate-manual-mutations.ts`。表单输入的是每 1 外币的原始现汇买入价，数据库 `prepare_manual_boc_rate` 保存原值并用十进制 `numeric` 计算每 100 外币的牌价。北京时间的报价日期和时间来自输入，记录来源为 `manual`。

写入后用 `exchange-rate-receipts.ts` 重新读取 `exchange_rate`，核对原编号、本次币种、报价日期、价格、时间和来源，页面用独立读回的行更新目录。编辑返回了仍然存在的旧报价时，旧记录不能证明新值已保存。人工录入与真实供应商报价分别标记来源。

## 供应商同步

`exchange-rate-sync/index.ts` 判断请求来源、登记运行并分派。当天和计划任务进入 `current-sync-run.ts`，历史补充和重新核算缺口进入 `history-sync-run.ts`，收款自动补缺进入 `settlement-repair-sync.ts`。当计划任务既没有要获取的币种也没有缺口，运行记为跳过。供应商读取在 `providers.ts`，报价解析在 `nowapi-quotes.ts`，写入在 `storage.ts`。浏览器请求需要启用的管理员身份，内部任务使用服务端持有的任务令牌。

浏览器当天获取表单在 `use-exchange-rate-current-fetch.ts`，自动配置与币种维护在 `use-exchange-rate-sync-settings.ts`，历史补充表单在 `use-exchange-rate-history-fetch.ts`。收到回执后，`exchange-rate-sync-results.ts` 先核对每个请求的币种和日期，再核对结果数量及运行状态。通过后，`exchange-rate-receipts.ts` 用当前会话分段查询报价，核对报价编号、价格、来源和时间，历史报价还要核对日末标记。只有部分目标完成时，页面会同时列出已核对和仍未完成的结果。

供应商数据按现汇买入价解析，历史补充核对同一业务日的有效报价和完整记录，选择最后一次有效报价。查看银行的公开表格可以区分现汇买入价、卖出价和折算价。系统通过 NowAPI 获取报价，公开网页读数和供应商接口的落库验收分开记证据。 [中国银行外汇牌价](https://www.boc.cn/sourcedb/whpj/)

业务计算使用指定日期的报价，不用其他日期来填空。公司成交汇率由 `company-exchange-rate.ts` 和对应数据库函数维护，人民币固定为 1。历史重新核算先取得报价核对凭证再执行，并保留每笔金额变化。

## 本地验证

- 数据库读取/维护权限按[后端汇率SQL手册](../../../../PT5-dropshipping-supabase/docs/onboarding/exchange-rate-sql-tests.md)准备九身份和非空夹具；八个活跃岗位读取、停用客户/匿名拒绝及管理员增改删使用真实SQL角色。它不代表上述原页面权限套件已经执行。
- 人工报价运行 `npm run test:learning:browser -- exchange-rate-manual`，使用专属测试账号和测试币种。页面保存后独立核对原始报价与每百单位牌价，改价保持同一编号，删除后刷新仍为空。
- 同步回执运行 `npm run test:learning:browser -- exchange-rate-sync-receipt`。通过页面发起请求，模拟函数响应，再用真实本地数据库核对报价编号、行版本、日末标记与刷新结果。
- 公司换算运行 `npm run test:company-exchange-rate`，真实函数入口编译运行 `npm run check:edge`。后端报价解析和计划任务终态测试见[后端函数指南](../../../../PT5-dropshipping-supabase/docs/onboarding/functions.md)。
- 真实供应商验收需要本地运行函数和合法的 NowAPI 凭据。全局汇率配置、固定账号及核算 SQL 使用隔离实例。正式外部报价、测试报价及本地函数逻辑验证分别记录。
