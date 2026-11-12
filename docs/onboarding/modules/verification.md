# 测试、合同与维护脚本

当前范围：开发。

## 业务与阅读顺序

保留可重复的测试、独立预期、运行证据和清理边界。

数据流：前提检查 → 自有夹具 → 页面/函数操作 → 独立读回 → 刷新与限定清理。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

旧受限辅助入口保持限制；合成边界、真实本地和真实供应商分别记录。

完成依据：退出码、完整日志、最终业务凭证与未执行原因一致，不能相加重复运行次数。

## 常见维护

修复断言时加入能检测错误结果的负例；新增测试同步模块地图。

验证入口：npm run check:learning；npm run test:learning；npm run test:regression（先满足准入）。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：本模块未发现字面量函数调用，沿服务导入继续追踪。

源码中直接引用的数据表/存储桶：本模块未发现字面量 from 调用。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。


## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [config/e2e-historical-cohort.json](../../../config/e2e-historical-cohort.json) | 已审保留：冻结历史审计的提交、入口和改名映射 |
| [config/operation-contracts.json](../../../config/operation-contracts.json) | 已审拆分：声明写操作触发入口和最终凭证；声明重试、失败提示及源码归属 |
| [scripts/assistant-event-stream.test.mjs](../../../scripts/assistant-event-stream.test.mjs) | 已审拆分：验证浏览器流完成条件；验证供应商取消与超时竞态 |
| [scripts/audit-real-e2e-prerequisites.mjs](../../../scripts/audit-real-e2e-prerequisites.mjs) | 已审拆分：遍历测试静态依赖；核对历史台账及当期入口；输出审计证据 |
| [scripts/auth-operation-receipts.test.mjs](../../../scripts/auth-operation-receipts.test.mjs) | 已审拆分：认证回执边界；改密待确认分类回归 |
| [scripts/check-dashboard-structure.mjs](../../../scripts/check-dashboard-structure.mjs) | 已审拆分：编排源码和样式扫描；校验共享界面结构与认证样式；输出规则失败 |
| [scripts/check-edge-functions.mjs](../../../scripts/check-edge-functions.mjs) | 已审保留：实际 Edge 入口发现；固定检查器运行与证据保存 |
| [scripts/check-i18n.mjs](../../../scripts/check-i18n.mjs) | 已审保留：比较中英文消息键和类型；定位 TSX 直接界面文字；报告双语静态检查结果 |
| [scripts/check-learning.mjs](../../../scripts/check-learning.mjs) | 已审拆分：学习检查调度与结果汇总 |
| [scripts/check-operation-contracts.mjs](../../../scripts/check-operation-contracts.mjs) | 已审拆分：调用契约清单校验；扫描源码调用和回执；输出检查与库存 |
| [scripts/clean-local-artifacts.mjs](../../../scripts/clean-local-artifacts.mjs) | 已审拆分：解析清理范围；保护解析后的路径；整理或删除指定本地产物 |
| [scripts/company-exchange-rate.test.mjs](../../../scripts/company-exchange-rate.test.mjs) | 已审保留：汇率折算和十进制舍入边界 |
| [scripts/dashboard-structure/dashboard-source-rules.mjs](../../../scripts/dashboard-structure/dashboard-source-rules.mjs) | 已审拆分：检查共享组件规则；检查工作台文件行数；检查响应式数据视图 |
| [scripts/dashboard-structure/information-hierarchy.mjs](../../../scripts/dashboard-structure/information-hierarchy.mjs) | 已审保留：校验页头职责与无障碍名称；阻止列表重复显示板块标题 |
| [scripts/dashboard-structure/source-facts.mjs](../../../scripts/dashboard-structure/source-facts.mjs) | 已审保留：发现 TS 和 TSX 源码；提取 JSX、导入、链接和状态样式事实 |
| [scripts/doctor.mjs](../../../scripts/doctor.mjs) | 已审拆分：工具配置与本机环境核验；服务与邮件接线诊断；迁移和后台安全状态诊断 |
| [scripts/document-archive-paths.test.mjs](../../../scripts/document-archive-paths.test.mjs) | 已审保留：验证 ZIP 路径碰撞和特殊名称；验证空目录和文件条目可解开 |
| [scripts/document-cleanup-local-port.mjs](../../../scripts/document-cleanup-local-port.mjs) | 已审拆分：清理领取；精确对象状态与删除；数据库完成凭证 |
| [scripts/document-cleanup-local.mjs](../../../scripts/document-cleanup-local.mjs) | 已审拆分：全实例清理前的专属环境准入；真实SDK与共用清理引擎调度；安全终态输出与失败退出 |
| [scripts/document-cleanup.test.mjs](../../../scripts/document-cleanup.test.mjs) | 已审保留：模拟清理边界并验证操作结果 |
| [scripts/document-library-origin.test.mjs](../../../scripts/document-library-origin.test.mjs) | 已审保留：验证资料库请求来源策略 |
| [scripts/document-upload-recovery.test.mjs](../../../scripts/document-upload-recovery.test.mjs) | 已审拆分：编译载入真实生产编排并注入外部边界；验证上传响应丢失及并发恢复；验证删除列表、旧凭证及并发终态 |
| [scripts/e2e-fixture-policy.test.mjs](../../../scripts/e2e-fixture-policy.test.mjs) | 已审拆分：专属目标准入规则；实际只读/写入/费用助手端口；调用方数据及浏览器资源生命周期 |
| [scripts/exchange-rate-sync-results.test.mjs](../../../scripts/exchange-rate-sync-results.test.mjs) | 已审拆分：验证当天回执契约；验证历史日期与币种笛卡尔组合 |
| [scripts/learning/assistant-settlement-fixture.test.mjs](../../../scripts/learning/assistant-settlement-fixture.test.mjs) | 已审保留：合成快照；版本及客户归属回归 |
| [scripts/learning/auth-sync-test-completion.test.mjs](../../../scripts/learning/auth-sync-test-completion.test.mjs) | 已审拆分：原Auth纯测试未完成时的子进程退出凭证 |
| [scripts/learning/boc-manual-rate-case.test.mjs](../../../scripts/learning/boc-manual-rate-case.test.mjs) | 已审保留：明确内存数据端口与完整报价样本；8项归属/单位/版本/未知结果风险；2项当前收尾函数白名单执行/多错误 |
| [scripts/learning/boc-quote-job-case.test.mjs](../../../scripts/learning/boc-quote-job-case.test.mjs) | 已审保留：合成六表快照；凭证归属与拒绝回归 |
| [scripts/learning/boc-recalculation-cohort.test.mjs](../../../scripts/learning/boc-recalculation-cohort.test.mjs) | 已审保留：显式完整图端口；9项范围/预览/终态/未知风险；2项原收尾白名单执行及多错误 |
| [scripts/learning/catalogue.mjs](../../../scripts/learning/catalogue.mjs) | 已审拆分：声明仓库边界及可学习源码范围；发现源码与学习文档；按业务路径判定模块归属 |
| [scripts/learning/check-learning.test.mjs](../../../scripts/learning/check-learning.test.mjs) | 已审拆分：清单和文档链接反例；源码摘要变更检查；跨目录业务归属 |
| [scripts/learning/clean-local-artifacts.test.mjs](../../../scripts/learning/clean-local-artifacts.test.mjs) | 已审拆分：创建并清理专属目录夹具；运行真实清理命令；核对文件及目录终态 |
| [scripts/learning/commission-merge-fixtures.test.mjs](../../../scripts/learning/commission-merge-fixtures.test.mjs) | 已审保留：订单凭证/写入/清理风险回归；函数目录/恢复未知结果回归；显式SQL响应模型 |
| [scripts/learning/company-template-hash-fault.test.mjs](../../../scripts/learning/company-template-hash-fault.test.mjs) | 已审保留：显式内存端口/完整图样本；七项哈希/未知结果边界；两项原收尾白名单加载与多错误检查 |
| [scripts/learning/company-template-records.test.mjs](../../../scripts/learning/company-template-records.test.mjs) | 已审拆分：模板/文档计数和删除边界；专属标记恢复与集合残留反例；真实SDK错误响应语义 |
| [scripts/learning/current-session-cache.test.mjs](../../../scripts/learning/current-session-cache.test.mjs) | 已审拆分：装载真实会话读取模块；构造可控 Auth 和数据库响应；核对退出、切换、重置及首轮读取 |
| [scripts/learning/customer-alias-fixture.test.mjs](../../../scripts/learning/customer-alias-fixture.test.mjs) | 已审拆分：真实SDK与明确内存记录/HTTP模型；当前夹具VM接线与合成目标检查；归属/修订/零回执/关闭失败及三错误回归 |
| [scripts/learning/dashboard-source-rules.test.mjs](../../../scripts/learning/dashboard-source-rules.test.mjs) | 已审拆分：验证精确例外路径；验证双形态规则仍生效 |
| [scripts/learning/doctor-checks.mjs](../../../scripts/learning/doctor-checks.mjs) | 已审拆分：配置存在性规范化；本项目URL白名单；工具及已确认版本风险 |
| [scripts/learning/doctor-checks.test.mjs](../../../scripts/learning/doctor-checks.test.mjs) | 已审拆分：验证只读诊断的配置与地址分类；验证维护命令的预览、重载和回滚 |
| [scripts/learning/document-cleanup-local-port.test.mjs](../../../scripts/learning/document-cleanup-local-port.test.mjs) | 已审拆分：真实SDK与引擎内存传输回归；实际CLI隔离拒绝；真实CLI限定依赖接线与终态退出 |
| [scripts/learning/document-fixture-cleanup.test.mjs](../../../scripts/learning/document-fixture-cleanup.test.mjs) | 已审保留：明确内存夹具；清理归属及失败反例 |
| [scripts/learning/document-fixture-store.test.mjs](../../../scripts/learning/document-fixture-store.test.mjs) | 已审保留：SDK 响应夹具；分页与回收凭证反例 |
| [scripts/learning/e2e-cohorts.mjs](../../../scripts/learning/e2e-cohorts.mjs) | 已审保留：对比历史及现有入口；校验显式改名映射 |
| [scripts/learning/e2e-cohorts.test.mjs](../../../scripts/learning/e2e-cohorts.test.mjs) | 已审保留：用合成清单验证增删改名规则 |
| [scripts/learning/exchange-rate-local-source.test.mjs](../../../scripts/learning/exchange-rate-local-source.test.mjs) | 已审保留：真实纯模块与生成壳的观察端口；协议拒绝和外部请求边界；并发快照及服务生命周期 |
| [scripts/learning/exchange-rate-quote-fixture.test.mjs](../../../scripts/learning/exchange-rate-quote-fixture.test.mjs) | 已审拆分：报价所有权/回执/版本及引用回归；供应商和原返回合同边界；新增金额样本校验回归 |
| [scripts/learning/exchange-rate-sync-cli.test.mjs](../../../scripts/learning/exchange-rate-sync-cli.test.mjs) | 已审拆分：原入口/环境拒绝及错误脱敏；原场景和夹具清单校验；午夜业务日期边界 |
| [scripts/learning/fixture-cleanup-sequence.test.mjs](../../../scripts/learning/fixture-cleanup-sequence.test.mjs) | 已审保留：真实顺序回收函数的异步与错误身份断言；当前线索CLI正文的显式进程/HTTP替身；创建、回执丢失与关闭失败收尾回归 |
| [scripts/learning/guide-rendering.test.mjs](../../../scripts/learning/guide-rendering.test.mjs) | 已审保留：指南审查失效与 Markdown 转义回归；受限路径不读内容回归 |
| [scripts/learning/inventory-order-fixture.test.mjs](../../../scripts/learning/inventory-order-fixture.test.mjs) | 已审保留：内存专属夹具构造；失败与并发边界；精确清理断言 |
| [scripts/learning/local-api-config.mjs](../../../scripts/learning/local-api-config.mjs) | 已审保留：解析明确API端口；核对项目回环原点 |
| [scripts/learning/local-api-config.test.mjs](../../../scripts/learning/local-api-config.test.mjs) | 已审保留：API段和原点边界回归；Windows保留范围及边界回归 |
| [scripts/learning/local-fixture-session.mjs](../../../scripts/learning/local-fixture-session.mjs) | 已审拆分：本地SQL独立读取；专属账号准备与清理；真实页面登录夹具 |
| [scripts/learning/logistics-assignment-case.test.mjs](../../../scripts/learning/logistics-assignment-case.test.mjs) | 已审保留：显式SQL响应模型；归属与两表清理风险回归；同步隔离协议模型 |
| [scripts/learning/logistics-source-fixture.test.mjs](../../../scripts/learning/logistics-source-fixture.test.mjs) | 已审拆分：真实HTTP与资源生命周期；明确合成的准入/回执/隐私；当前辅助及原页面网络内核 |
| [scripts/learning/mail-boundary.test.mjs](../../../scripts/learning/mail-boundary.test.mjs) | 已审拆分：HTTP 失败与资源回收验证；Gmail/AI/飞书协议验证；OAuth 模式验证 |
| [scripts/learning/mail-fixture-data.test.mjs](../../../scripts/learning/mail-fixture-data.test.mjs) | 已审拆分：邮箱与加密材料关联；人员及消息关系；清理顺序和失败停止 |
| [scripts/learning/mail-fixture-records.test.mjs](../../../scripts/learning/mail-fixture-records.test.mjs) | 已审拆分：插入丢失或错误凭证检查；清理缺失影响数或残留检查；失败停止与cause检查 |
| [scripts/learning/manual-review.mjs](../../../scripts/learning/manual-review.mjs) | 已审保留：逐文件审查校验；待审清单注册 |
| [scripts/learning/manual-review.test.mjs](../../../scripts/learning/manual-review.test.mjs) | 已审保留：人工审查摘要和完整性反例 |
| [scripts/learning/module-definitions.mjs](../../../scripts/learning/module-definitions.mjs) | 已审保留：汇总模块事实和指南路径 |
| [scripts/learning/module-validation.mjs](../../../scripts/learning/module-validation.mjs) | 已审保留：模块路径与唯一归属验证；Markdown 本地链接验证 |
| [scripts/learning/modules/business.mjs](../../../scripts/learning/modules/business.mjs) | 已审拆分：登记主要业务模块的学习入口；声明已核对的权限来源、完成凭证和验收命令 |
| [scripts/learning/modules/collaboration.mjs](../../../scripts/learning/modules/collaboration.mjs) | 已审拆分：协作模块目录定义 |
| [scripts/learning/modules/maintenance.mjs](../../../scripts/learning/modules/maintenance.mjs) | 已审保留：登记维护模块的职责与验证入口 |
| [scripts/learning/modules/platform.mjs](../../../scripts/learning/modules/platform.mjs) | 已审拆分：基础设施模块学习说明 |
| [scripts/learning/monthly-settlement-lifecycle.test.mjs](../../../scripts/learning/monthly-settlement-lifecycle.test.mjs) | 已审拆分：实际SDK内存HTTP夹具；准备与清理风险反例；抽取原声明失败生命周期 |
| [scripts/learning/operation-contract-manifest.test.mjs](../../../scripts/learning/operation-contract-manifest.test.mjs) | 已审拆分：创建并清理清单夹具；运行真实校验 CLI；核对失败分类和合法入口 |
| [scripts/learning/operator-reimbursement-fixture.test.mjs](../../../scripts/learning/operator-reimbursement-fixture.test.mjs) | 已审拆分：身份/周期和业务凭证风险；版本/范围/实际行数及未知结果；报告副本及清理确认的控制流验证 |
| [scripts/learning/owned-governance-todo.test.mjs](../../../scripts/learning/owned-governance-todo.test.mjs) | 已审拆分：内存故障夹具；归属、影响数与收尾反例 |
| [scripts/learning/postgres-document-lock.test.mjs](../../../scripts/learning/postgres-document-lock.test.mjs) | 已审拆分：进程事件生命周期故障模拟；真实接线与SQL目标参数断言 |
| [scripts/learning/recalculation-preview-response.test.mjs](../../../scripts/learning/recalculation-preview-response.test.mjs) | 已审保留：精确路径/方法/UUID关联；点击/等待/JSON失败保持 |
| [scripts/learning/refresh-map.mjs](../../../scripts/learning/refresh-map.mjs) | 已审拆分：学习资料刷新调度 |
| [scripts/learning/reimbursement-sharing-case.test.mjs](../../../scripts/learning/reimbursement-sharing-case.test.mjs) | 已审保留：显式数据端口和完整记录样本；11项归属/终态/未知结果风险检查；原安全辅助白名单加载及收尾错误断言 |
| [scripts/learning/render-module-guides.mjs](../../../scripts/learning/render-module-guides.mjs) | 已审保留：模块文件阅读说明；模块指南生成；模块总索引生成 |
| [scripts/learning/review-coverage.mjs](../../../scripts/learning/review-coverage.mjs) | 已审拆分：有效审查覆盖汇总；覆盖表漂移验证 |
| [scripts/learning/review-coverage.test.mjs](../../../scripts/learning/review-coverage.test.mjs) | 已审拆分：摘要漂移与覆盖表回归验证 |
| [scripts/learning/run-order-assessment-local.mjs](../../../scripts/learning/run-order-assessment-local.mjs) | 已审保留：校验并设置本地模拟边界；调度专属页面用例；恢复和核对临时配置 |
| [scripts/learning/sales-lead-conversion-fixture.test.mjs](../../../scripts/learning/sales-lead-conversion-fixture.test.mjs) | 已审拆分：原转换凭证/接线边界；大厅/管理员生命周期故障；原转换夹具编辑/恢复与草稿回归 |
| [scripts/learning/scan-module-sources.mjs](../../../scripts/learning/scan-module-sources.mjs) | 已审保留：模块源码与测试路径收集；运行源码结构扫描；迁移历史声明提取 |
| [scripts/learning/settlement-fixture-cleanup.test.mjs](../../../scripts/learning/settlement-fixture-cleanup.test.mjs) | 已审拆分：专属准入与进程反例；真实SDK内存正文合同；抽取真实声明的失败收尾 |
| [scripts/learning/settlement-repair-receipts.test.mjs](../../../scripts/learning/settlement-repair-receipts.test.mjs) | 已审保留：显式模拟快照；正常与错误凭证回归 |
| [scripts/learning/shanghai-calendar.test.mjs](../../../scripts/learning/shanghai-calendar.test.mjs) | 已审拆分：跨宿主时区日历回归 |
| [scripts/learning/source-validation.mjs](../../../scripts/learning/source-validation.mjs) | 已审保留：运行源码摘要验证；迁移快照绑定验证 |
| [scripts/learning/template-document-fixture-cleanup.test.mjs](../../../scripts/learning/template-document-fixture-cleanup.test.mjs) | 已审保留：归属内存表；失败及分批反例；真实 SDK 模拟响应契约 |
| [scripts/learning/template-draft-fixtures.test.mjs](../../../scripts/learning/template-draft-fixtures.test.mjs) | 已审拆分：故障安装/移除控制流；清理身份/快照/影响数边界；SQL字面量/去重/未知结果与OID回归 |
| [scripts/learning/user-media-operation-verifier.test.mjs](../../../scripts/learning/user-media-operation-verifier.test.mjs) | 已审保留：本地认证依赖协议模型；公开运行凭证风险回归；自身撤销与多错误回归 |
| [scripts/learning/user-media-owned-case.test.mjs](../../../scripts/learning/user-media-owned-case.test.mjs) | 已审保留：归属/内容/评估内存端口模型；分阶段清理与未知结果风险；原页面收尾函数错误保留 |
| [scripts/learning/wholesale-direct-usd-settlement.test.mjs](../../../scripts/learning/wholesale-direct-usd-settlement.test.mjs) | 已审拆分：明确JSON端口与三种金额期望；完整图/请求/报价的六项风险回归；重复确认及拒绝重绑检查 |
| [scripts/learning/wholesale-fee-commission-fault.test.mjs](../../../scripts/learning/wholesale-fee-commission-fault.test.mjs) | 已审保留：受控故障与恢复专项；假成功/回执丢失保护；陌生字段及同值新版本拒绝 |
| [scripts/learning/wholesale-fee-customer-fixture.test.mjs](../../../scripts/learning/wholesale-fee-customer-fixture.test.mjs) | 已审拆分：客户生命周期专项；档案/引用/错回执保护；历史准备与丢回执专项 |
| [scripts/learning/wholesale-fee-order-fixture.test.mjs](../../../scripts/learning/wholesale-fee-order-fixture.test.mjs) | 已审拆分：初态清单与限定回收专项；固定USD样本及丢回执；陌生版本与无效样本拒绝 |
| [scripts/learning/wholesale-fee-page-route.test.mjs](../../../scripts/learning/wholesale-fee-page-route.test.mjs) | 已审拆分：原请求及错误回执专项；取消/并发/闸门释放保护；原页面收尾回调核对 |
| [scripts/learning/wholesale-fee-parameter-fixture.test.mjs](../../../scripts/learning/wholesale-fee-parameter-fixture.test.mjs) | 已审拆分：参数原请求与完整绑定专项；原子恢复/错回执保护；原afterAll继续收尾核对 |
| [scripts/learning/wholesale-fee-transitions.test.mjs](../../../scripts/learning/wholesale-fee-transitions.test.mjs) | 已审拆分：结汇/改单业务断言 |
| [scripts/learning/wholesale-mutation-failure-scope.test.mjs](../../../scripts/learning/wholesale-mutation-failure-scope.test.mjs) | 已审拆分：九操作及读取/Auth分类回归；并发/回包失败与假命中保护；摘要及自动收尾回归 |
| [scripts/learning/wholesale-order-attachment-fixture.test.mjs](../../../scripts/learning/wholesale-order-attachment-fixture.test.mjs) | 已审拆分：附件成功/失败凭证回归；原会话与SQL/资产边界回归；登录前context故障回归 |
| [scripts/learning/wholesale-release-fixture.test.mjs](../../../scripts/learning/wholesale-release-fixture.test.mjs) | 已审保留：模拟明确SQL快照；范围及未知提交回归 |
| [scripts/learning/wholesale-settlement-page.test.mjs](../../../scripts/learning/wholesale-settlement-page.test.mjs) | 已审拆分：实际页面助手的响应时序回归 |
| [scripts/learning/wholesale-upload-journal.test.mjs](../../../scripts/learning/wholesale-upload-journal.test.mjs) | 已审拆分：核对用户、订单、路径及大小边界；核对实际摘要、文件配对和登记来源；核对限定清理及存储失败的留证 |
| [scripts/learning/windows-port-exclusions.mjs](../../../scripts/learning/windows-port-exclusions.mjs) | 已审保留：解析数字保留范围；生成端口诊断；只读调用系统表 |
| [scripts/learning/write-learning-indexes.mjs](../../../scripts/learning/write-learning-indexes.mjs) | 已审保留：学习文档路径汇集；机器索引落盘 |
| [scripts/login-recovery.test.cjs](../../../scripts/login-recovery.test.cjs) | 已审保留：装载受控真实登录模块；验证登录恢复和认证传输；验证服务端身份与代理失败处理 |
| [scripts/mail-google-push.test.cjs](../../../scripts/mail-google-push.test.cjs) | 已审保留：本机证书与签名夹具；真实官方验签及声明反例；测试服务与环境回收 |
| [scripts/mail-inbound-recovery.test.cjs](../../../scripts/mail-inbound-recovery.test.cjs) | 已审拆分：构造隔离 Gmail、归档和数据库边界；验证真实分页、回补调度及 Watch 续订结果 |
| [scripts/mail-intake.test.mjs](../../../scripts/mail-intake.test.mjs) | 已审保留：稳定邮件别名规则；收件规则与收件人集合；已有负责人路由 |
| [scripts/mail-outbound-reconciliation.test.cjs](../../../scripts/mail-outbound-reconciliation.test.cjs) | 已审拆分：提供供应商和数据库隔离边界；执行真实发件对账代码并确认只发送一次 |
| [scripts/mail-routing-members.test.cjs](../../../scripts/mail-routing-members.test.cjs) | 已审保留：有限查询数据夹具；原名单与路由模块执行；岗位与故障回归断言 |
| [scripts/mail-security.test.mjs](../../../scripts/mail-security.test.mjs) | 已审保留：邮件密文读取与格式；独立向量和篡改拒绝 |
| [scripts/minimatch-security.test.cjs](../../../scripts/minimatch-security.test.cjs) | 已审保留：CVE范围及锁/实际安装一致性；真实新旧调用方API；受限线程模式展开 |
| [scripts/operation-contract-manifest.mjs](../../../scripts/operation-contract-manifest.mjs) | 已审拆分：校验操作字段及编号唯一性；识别实际 Web 来源或纯后台声明 |
| [scripts/operation-runs.test.mjs](../../../scripts/operation-runs.test.mjs) | 已审拆分：验证成功终态条件；覆盖错配运行与非法计数；验证最后读回的实际状态 |
| [scripts/operator-reimbursement-receipts.test.mjs](../../../scripts/operator-reimbursement-receipts.test.mjs) | 已审保留：周期报销回执与数值边界 |
| [scripts/profile-operation-receipts.test.mjs](../../../scripts/profile-operation-receipts.test.mjs) | 已审保留：资料写入身份与逐字段凭证；申请身份/状态与逐字段凭证；当前恢复函数的SDK传输与归属/失败回归 |
| [scripts/public-site-origin.test.mjs](../../../scripts/public-site-origin.test.mjs) | 已审保留：公开地址与来源策略；授权返回及固定角色入口；告警去重和脱敏 |
| [scripts/record-test-run.mjs](../../../scripts/record-test-run.mjs) | 已审保留：启动原命令并记录退出；保存双路日志；写出运行摘要凭证 |
| [scripts/record-test-run.test.mjs](../../../scripts/record-test-run.test.mjs) | 已审拆分：验证记录和并发隔离；验证失败与篡改；清理专属测试目录 |
| [scripts/security-dependencies.test.cjs](../../../scripts/security-dependencies.test.cjs) | 已审保留：HTML 安全清洗；邮件构建和密送边界；原生图片转换 |
| [scripts/server-request-body.test.mjs](../../../scripts/server-request-body.test.mjs) | 已审保留：请求体边界回归 |
| [scripts/storage-operation-receipts.test.mjs](../../../scripts/storage-operation-receipts.test.mjs) | 已审拆分：Storage 回执合同回归；精确目录分页回归 |
| [scripts/supabase-admin.mjs](../../../scripts/supabase-admin.mjs) | 已审拆分：命令分派与结果输出 |
| [scripts/supabase-admin/connection.mjs](../../../scripts/supabase-admin/connection.mjs) | 已审拆分：读取管理命令配置；建立特权客户端 |
| [scripts/supabase-admin/order-status.mjs](../../../scripts/supabase-admin/order-status.mjs) | 已审拆分：验证状态写入回执；独立读回同一订单 |
| [scripts/supabase-admin/read-commands.mjs](../../../scripts/supabase-admin/read-commands.mjs) | 已审拆分：表概览查询；指定表读取；普通订单及子表查询 |
| [scripts/template-content-sandbox.test.cjs](../../../scripts/template-content-sandbox.test.cjs) | 已审保留：真实内容路由的隔离加载；浏览器来源存储探针；临时服务和上下文清理 |
| [scripts/template-document-origin.test.mjs](../../../scripts/template-document-origin.test.mjs) | 已审保留：生产与开发文档握手来源 |
| [scripts/test-run-evidence.mjs](../../../scripts/test-run-evidence.mjs) | 已审保留：按字节生成日志摘要；核验凭证与双路日志 |
| [scripts/user-media-preview-cache.test.mjs](../../../scripts/user-media-preview-cache.test.mjs) | 已审保留：预览签名缓存故障回归 |
| [scripts/verified-action-outcome.test.mjs](../../../scripts/verified-action-outcome.test.mjs) | 已审保留：写入、刷新顺序和终态检查 |
| [scripts/verify-test-run.mjs](../../../scripts/verify-test-run.mjs) | 已审保留：解析目录参数并传递核验退出码 |
| [scripts/wholesale-order-fees.test.mjs](../../../scripts/wholesale-order-fees.test.mjs) | 已审保留：费用计算和舍入顺序检查 |
| [scripts/wholesale-settlement-unallocated-summary.test.mjs](../../../scripts/wholesale-settlement-unallocated-summary.test.mjs) | 已审保留：上海月份与收款日期范围；有效分配扣减与分币种合计；大集合与异常数值检查 |
| [tests/contracts/admin-orders-retained.spec.ts](../../../tests/contracts/admin-orders-retained.spec.ts) | 已审拆分：验证空授权范围不发查询；验证服务详情费率来源和舍入；验证三类订单提交结构与缺字段失败 |
| [tests/contracts/admin-task-assignment.spec.ts](../../../tests/contracts/admin-task-assignment.spec.ts) | 已审拆分：改派凭证及未写入合同；共享表单默认值回归 |
| [tests/contracts/admin-task-deletion.spec.ts](../../../tests/contracts/admin-task-deletion.spec.ts) | 已审拆分：任务凭证及存储分组测试 |
| [tests/contracts/admin-task-route.spec.ts](../../../tests/contracts/admin-task-route.spec.ts) | 已审拆分：批量重置及 URL 往返回归；任务状态与文本筛选回归 |
| [tests/contracts/admin-task-type-management.spec.ts](../../../tests/contracts/admin-task-type-management.spec.ts) | 已审拆分：类型写入字段合同；独立读回与失败矩阵 |
| [tests/contracts/document-library.spec.ts](../../../tests/contracts/document-library.spec.ts) | 已审拆分：格式和大小边界反例；操作凭证拒绝检查 |
| [tests/contracts/helpers/render-home-editor.ts](../../../tests/contracts/helpers/render-home-editor.ts) | 已审拆分：受控 TSX 及依赖加载；固定五卡编辑器渲染 |
| [tests/contracts/home-editor-geometry.spec.ts](../../../tests/contracts/home-editor-geometry.spec.ts) | 已审拆分：实际卡片标记和几何检查；删除、错放与碰撞反例 |
| [tests/contracts/logistics-paging-oracle.spec.ts](../../../tests/contracts/logistics-paging-oracle.spec.ts) | 已审拆分：独立分页集合与身份反例；微秒和时区排序边界；夹具清单输入拒绝 |
| [tests/contracts/playwright.config.ts](../../../tests/contracts/playwright.config.ts) | 已审保留：受控合同套件运行配置 |
| [tests/contracts/retained-commission-settlement.spec.ts](../../../tests/contracts/retained-commission-settlement.spec.ts) | 已审拆分：验证订单与任务结算回执及读回；注入错配、缺失、状态错误和数据库冲突 |
| [tests/contracts/retained-tourism-display.spec.ts](../../../tests/contracts/retained-tourism-display.spec.ts) | 已审拆分：核对订单快照转换与多条件筛选；核对中英文团队标签；核对任务人数校验 |
| [tests/contracts/task-file-preview.spec.ts](../../../tests/contracts/task-file-preview.spec.ts) | 已审拆分：附件签名响应顺序回归 |
| [tests/contracts/task-review-decisions.spec.ts](../../../tests/contracts/task-review-decisions.spec.ts) | 已审拆分：审核函数参数合同；独立终态失败矩阵 |
| [tests/contracts/task-review-submission-flow.spec.ts](../../../tests/contracts/task-review-submission-flow.spec.ts) | 已审拆分：模拟网络边界；提审读回与补偿断言 |
| [tests/contracts/tourism-collaboration-retained.spec.ts](../../../tests/contracts/tourism-collaboration-retained.spec.ts) | 已审拆分：团队快照合同；旅游人员范围合同；任务地址与筛选合同 |
| [tests/contracts/workspace-page-contracts.spec.ts](../../../tests/contracts/workspace-page-contracts.spec.ts) | 已审拆分：十三页正文正反例；错误页与结构故障；双宽度刷新和手机筛选 |
| [tests/e2e/account-switcher.spec.ts](../../../tests/e2e/account-switcher.spec.ts) | 已审拆分：账号切换生命周期用例；身份与刷新终态核对 |
| [tests/e2e/admin-auth-sync-recovery.spec.ts](../../../tests/e2e/admin-auth-sync-recovery.spec.ts) | 已审保留：旧 Auth 同步补偿场景；种子状态快照与恢复 |
| [tests/e2e/admin-person-account-bundle.spec.ts](../../../tests/e2e/admin-person-account-bundle.spec.ts) | 已审拆分：专属账号准备与清理；页面调整及最终凭证；旧 Auth 偏差与补偿 |
| [tests/e2e/ai-assistant-settlement-release.spec.ts](../../../tests/e2e/ai-assistant-settlement-release.spec.ts) | 已审拆分：正式与临时确认；解析和直接权限；歧义客户与刷新 |
| [tests/e2e/api-request-limits.spec.ts](../../../tests/e2e/api-request-limits.spec.ts) | 已审保留：请求解析和大小拒绝 |
| [tests/e2e/auth-motion.spec.ts](../../../tests/e2e/auth-motion.spec.ts) | 已审拆分：认证页首屏动效令牌；减少动效偏好 |
| [tests/e2e/auth-network.spec.ts](../../../tests/e2e/auth-network.spec.ts) | 已审保留：密码可见与等待恢复；真实认证及独立身份；错误密码和旧路由边界 |
| [tests/e2e/auth.spec.ts](../../../tests/e2e/auth.spec.ts) | 已审保留：岗位与服务范围登录矩阵；旧身份与未启用账号；匿名和注册受理提示 |
| [tests/e2e/business-parameter-order-lock.spec.ts](../../../tests/e2e/business-parameter-order-lock.spec.ts) | 已审拆分：编排旧新订单的参数锁定场景；下月预约页面断言；测试资源生命周期 |
| [tests/e2e/business-parameter-settings.spec.ts](../../../tests/e2e/business-parameter-settings.spec.ts) | 已审拆分：参数发布预约取消恢复场景；虚假成功与提交断线重试场景；岗位与响应式断言 |
| [tests/e2e/client-business-access.spec.ts](../../../tests/e2e/client-business-access.spec.ts) | 已审拆分：编排停用业务与客户添加页面操作；调用独立读回并核对刷新及宽度 |
| [tests/e2e/company-expenses.spec.ts](../../../tests/e2e/company-expenses.spec.ts) | 已审拆分：岗位访问场景；费用页面操作与最终凭证断言；手机宽度检查 |
| [tests/e2e/company-template-document-evidence.spec.ts](../../../tests/e2e/company-template-document-evidence.spec.ts) | 已审拆分：专属错误正文反例；页面恢复与独立读回；限定回收 |
| [tests/e2e/company-template-document-failures.spec.ts](../../../tests/e2e/company-template-document-failures.spec.ts) | 已审拆分：文档离线、冲突与失败场景调度；版本固定与正文独立核对；专属资源生命周期与清理 |
| [tests/e2e/company-template-document-printing.spec.ts](../../../tests/e2e/company-template-document-printing.spec.ts) | 已审拆分：打印必填与状态恢复；独立正文核对；专属夹具生命周期 |
| [tests/e2e/company-template-document-restoration.spec.ts](../../../tests/e2e/company-template-document-restoration.spec.ts) | 已审拆分：串行保存观察；最新修改及刷新断言；专属夹具生命周期 |
| [tests/e2e/company-template-document-size-limit.spec.ts](../../../tests/e2e/company-template-document-size-limit.spec.ts) | 已审拆分：超限拒绝与页面保留；恢复后保存和读回；专属夹具生命周期 |
| [tests/e2e/company-template-documents.spec.ts](../../../tests/e2e/company-template-documents.spec.ts) | 已审拆分：文档内容恢复；管理与访问旅程；凭证布局及清理 |
| [tests/e2e/company-template-folder-permissions.spec.ts](../../../tests/e2e/company-template-folder-permissions.spec.ts) | 已审拆分：管理员与业务员协作；客户权限反例；上下文及夹具回收 |
| [tests/e2e/company-template-folder-recovery.spec.ts](../../../tests/e2e/company-template-folder-recovery.spec.ts) | 已审拆分：另存断线与原编号重试；独立位置反例及恢复；专属数据回收 |
| [tests/e2e/company-template-folders.spec.ts](../../../tests/e2e/company-template-folders.spec.ts) | 已审拆分：目录内完整文档旅程；独立记录和布局断言；专属资源回收 |
| [tests/e2e/company-template-generic-saving.spec.ts](../../../tests/e2e/company-template-generic-saving.spec.ts) | 已审拆分：普通HTML动态交互与自动保存场景；独立状态及刷新恢复断言；专属记录回收及证据输出 |
| [tests/e2e/company-template-isolation.spec.ts](../../../tests/e2e/company-template-isolation.spec.ts) | 已审保留：两卡专属夹具生命周期；独立展开及高度断言；刷新与错误检查 |
| [tests/e2e/company-template-navigation.spec.ts](../../../tests/e2e/company-template-navigation.spec.ts) | 已审保留：预览导航等待；刷新恢复；移动入口断言 |
| [tests/e2e/company-template-original-html.spec.ts](../../../tests/e2e/company-template-original-html.spec.ts) | 已审拆分：原HTML发布与保存场景；版本能力固定与刷新断言；本次夹具及结果文件收尾 |
| [tests/e2e/company-template-production-protocol.spec.ts](../../../tests/e2e/company-template-production-protocol.spec.ts) | 已审拆分：报价单和发票原模板场景；未握手正文的恢复断言；专属草稿、文档及证据收尾 |
| [tests/e2e/company-template-raw-quotation.spec.ts](../../../tests/e2e/company-template-raw-quotation.spec.ts) | 已审拆分：固定指纹的原报价单交互场景；数据库/刷新及失败差异诊断；专属记录回收及证据输出 |
| [tests/e2e/company-templates.spec.ts](../../../tests/e2e/company-templates.spec.ts) | 已审拆分：原固定模板/版本、七岗位及合成HTML共同输入；按原顺序注册18个页面场景 |
| [tests/e2e/customer-inventory-orders.spec.ts](../../../tests/e2e/customer-inventory-orders.spec.ts) | 已审拆分：八个原场景注册；专属夹具启停；精确清理凭证 |
| [tests/e2e/dashboard-framework.spec.ts](../../../tests/e2e/dashboard-framework.spec.ts) | 已审保留：四岗位页面外壳；表单错误保留输入；当前启用页面手机宽度 |
| [tests/e2e/dashboard-home-customization.spec.ts](../../../tests/e2e/dashboard-home-customization.spec.ts) | 已审拆分：紧凑响应式页面；组件增删及排序；保存失败与重试 |
| [tests/e2e/dashboard-home-invite-controls.spec.ts](../../../tests/e2e/dashboard-home-invite-controls.spec.ts) | 已审拆分：三岗位邀请卡片尺寸与触控 |
| [tests/e2e/dashboard-home-resize.spec.ts](../../../tests/e2e/dashboard-home-resize.spec.ts) | 已审拆分：桌面编辑流程组装 |
| [tests/e2e/dashboard-home-role-tasks.spec.ts](../../../tests/e2e/dashboard-home-role-tasks.spec.ts) | 已审拆分：五岗位快捷入口旅程 |
| [tests/e2e/dashboard-home-widget-minimums.spec.ts](../../../tests/e2e/dashboard-home-widget-minimums.spec.ts) | 已审拆分：默认尺寸合同；最小尺寸按钮限制；最小尺寸功能可见性 |
| [tests/e2e/dashboard-my-password-reset.spec.ts](../../../tests/e2e/dashboard-my-password-reset.spec.ts) | 已审保留：账号页重置请求模拟与冷却；桌面/手机宽度断言；请求载荷与溢出读取 |
| [tests/e2e/dashboard-numbered-pages.spec.ts](../../../tests/e2e/dashboard-numbered-pages.spec.ts) | 已审拆分：专属费用数据与清理凭证；页码筛选及启用列表矩阵；响应式分页底栏 |
| [tests/e2e/dashboard-responsive-ui.spec.ts](../../../tests/e2e/dashboard-responsive-ui.spec.ts) | 已审保留：首页/顶栏/费用的共同响应式场景；触控、裁切与实色sRGB测量辅助；固定角色的专属执行前置 |
| [tests/e2e/dashboard-search-input.spec.ts](../../../tests/e2e/dashboard-search-input.spec.ts) | 已审保留：搜索图标与文字几何；输入及页面宽度 |
| [tests/e2e/dashboard-table-divider.spec.ts](../../../tests/e2e/dashboard-table-divider.spec.ts) | 已审保留：单元格分隔色与令牌；桌面表格及手机卡片 |
| [tests/e2e/date-picker.spec.ts](../../../tests/e2e/date-picker.spec.ts) | 已审保留：中文日期交互与恢复；英文显示及ISO值；日期范围与焦点 |
| [tests/e2e/design-system-controls.spec.ts](../../../tests/e2e/design-system-controls.spec.ts) | 已审拆分：认证与工作台共享控件一致性 |
| [tests/e2e/design-system-forms.spec.ts](../../../tests/e2e/design-system-forms.spec.ts) | 已审拆分：指标呈现与助手避让；标准字段关联与焦点；缺项提交后的输入保留 |
| [tests/e2e/design-system-governance.spec.ts](../../../tests/e2e/design-system-governance.spec.ts) | 已审拆分：控件高度与筛选空间；分页几何；VIP 响应式断点 |
| [tests/e2e/design-system-todo-form.spec.ts](../../../tests/e2e/design-system-todo-form.spec.ts) | 已审拆分：专属待办页面流程；字段错误及真实记录核对 |
| [tests/e2e/design-system-visual.spec.ts](../../../tests/e2e/design-system-visual.spec.ts) | 已审拆分：公开与授权状态截图；代表工作台与表单截图；断点与浮层几何 |
| [tests/e2e/document-explorer-loading.spec.ts](../../../tests/e2e/document-explorer-loading.spec.ts) | 已审拆分：局部读取与浏览器历史场景；批量通知与尺寸断言；本次截图、结果及清理 |
| [tests/e2e/document-explorer-preview.spec.ts](../../../tests/e2e/document-explorer-preview.spec.ts) | 已审拆分：PDF/图片预览；普通及 ZIP 下载字节；英文刷新 |
| [tests/e2e/document-explorer-recovery.spec.ts](../../../tests/e2e/document-explorer-recovery.spec.ts) | 已审拆分：拖放及响应丢失恢复场景；目录边界与撤权场景；专属故障准入及顺序回收 |
| [tests/e2e/document-explorer.spec.ts](../../../tests/e2e/document-explorer.spec.ts) | 已审拆分：目录导航/ZIP/分页场景；跨人员移动与模板完整旅程；键盘当前交互和专属回收 |
| [tests/e2e/document-library-boundaries.spec.ts](../../../tests/e2e/document-library-boundaries.spec.ts) | 已审拆分：非空确认清单；并发版本与幂等；跨档案移动及删除 |
| [tests/e2e/document-library-cleanup.spec.ts](../../../tests/e2e/document-library-cleanup.spec.ts) | 已审拆分：中断阶段夹具；全实例过期清理运行；终态与已完成文件保护 |
| [tests/e2e/document-library-copy-failures.spec.ts](../../../tests/e2e/document-library-copy-failures.spec.ts) | 已审拆分：同名冲突与原编号重试；快捷键/独立对象复制；来源缺失与续办核对 |
| [tests/e2e/document-library-faults.spec.ts](../../../tests/e2e/document-library-faults.spec.ts) | 已审拆分：登记/清理失败与续办场景；零影响删除凭证场景；专属故障SQL和清理子进程调度 |
| [tests/e2e/document-library-linking.spec.ts](../../../tests/e2e/document-library-linking.spec.ts) | 已审拆分：专属账号/客户夹具准备与回收；客户关联页面及删除保护场景；档案/对象保留与默认目录核对 |
| [tests/e2e/document-library-permissions.spec.ts](../../../tests/e2e/document-library-permissions.spec.ts) | 已审拆分：岗位/客户API与Storage拒绝场景；失败上传/错凭证及断线恢复；专属原始对象和资料回收 |
| [tests/e2e/document-library-personal-migration.spec.ts](../../../tests/e2e/document-library-personal-migration.spec.ts) | 已审拆分：迁移前目录与非空夹具场景；原迁移执行及状态/字节核对；所有者页面与限定收尾 |
| [tests/e2e/document-library-workspace.spec.ts](../../../tests/e2e/document-library-workspace.spec.ts) | 已审拆分：首页入口/行内创建与菜单场景；整树复制/断线/重复编号场景；深层位置/岗位权限与回收 |
| [tests/e2e/document-library.spec.ts](../../../tests/e2e/document-library.spec.ts) | 已审拆分：文件夹与文件完整页面旅程；员工共享管理和无业务岗位场景；权威记录/对象与限定收尾 |
| [tests/e2e/document-profile-entrypoints.spec.ts](../../../tests/e2e/document-profile-entrypoints.spec.ts) | 已审拆分：个人资料和人员详情档案权限 |
| [tests/e2e/document-unified-migration.spec.ts](../../../tests/e2e/document-unified-migration.spec.ts) | 已审拆分：旧客户目录非空迁移场景；编号/内容/字节及旧窗口冲突核对；专属执行和产物/夹具回收 |
| [tests/e2e/document-windows-outcome.spec.ts](../../../tests/e2e/document-windows-outcome.spec.ts) | 已审拆分：故障准备；名称/版本页面与权威核对；限定故障对象回收 |
| [tests/e2e/document-windows-template.spec.ts](../../../tests/e2e/document-windows-template.spec.ts) | 已审拆分：公共模板文档改名；版本冲突与响应丢失重试；正文/草稿/回执限定回收 |
| [tests/e2e/document-windows-timeout.spec.ts](../../../tests/e2e/document-windows-timeout.spec.ts) | 已审拆分：原等待上限与未确认页面；权威无写入与刷新 |
| [tests/e2e/document-windows.spec.ts](../../../tests/e2e/document-windows.spec.ts) | 已审拆分：入口/行内命名/输入法与冲突场景；公共协作/移动复制与读取权限；布局/分页及限定资源回收 |
| [tests/e2e/exchange-rate-boc.spec.ts](../../../tests/e2e/exchange-rate-boc.spec.ts) | 已审拆分：三场景串行调度；原页面动作与独立结果断言；每次运行的四张截图 |
| [tests/e2e/exchange-rate-history.spec.ts](../../../tests/e2e/exchange-rate-history.spec.ts) | 已审拆分：专属报价前提与生命周期；历史补取及响应式场景；报价和运行尝试独立核对 |
| [tests/e2e/exchange-rate-visibility.spec.ts](../../../tests/e2e/exchange-rate-visibility.spec.ts) | 已审保留：四个有业务岗位、三个无业务岗位及客户的页面入口场景；管理员/只读控件展示边界；桌面和手机横向溢出检查 |
| [tests/e2e/finance-business-access.spec.ts](../../../tests/e2e/finance-business-access.spec.ts) | 已审保留：推荐佣金身份一致读取；财务业务入口允许/拒绝矩阵；桌面和手机导航边界 |
| [tests/e2e/forgot-password.spec.ts](../../../tests/e2e/forgot-password.spec.ts) | 已审保留：找回请求反馈及安全跳转；恢复会话与表单准入；固定令牌场景隔离前提 |
| [tests/e2e/helpers/account-switcher-storage.ts](../../../tests/e2e/helpers/account-switcher-storage.ts) | 已审拆分：存储过期和无效令牌注入；脱敏存储摘要 |
| [tests/e2e/helpers/account-switcher-ui.ts](../../../tests/e2e/helpers/account-switcher-ui.ts) | 已审拆分：原账号切换页面步骤；布局和触控尺寸核对 |
| [tests/e2e/helpers/accounts.ts](../../../tests/e2e/helpers/accounts.ts) | 受限：只登记路径，不读取内容。 |
| [tests/e2e/helpers/assistant-settlement-environment.ts](../../../tests/e2e/helpers/assistant-settlement-environment.ts) | 已审保留：服务端专属目标；本机模型拒绝端口；页面生命周期与附件 |
| [tests/e2e/helpers/assistant-settlement-page.ts](../../../tests/e2e/helpers/assistant-settlement-page.ts) | 已审保留：助手开关及可读布局；同卡片响应与503；原歧义客户创建删除动作 |
| [tests/e2e/helpers/auth.ts](../../../tests/e2e/helpers/auth.ts) | 已审保留：表单登录与岗位终点判定；语言cookie选择；工作台与权限断言 |
| [tests/e2e/helpers/boc-manual-rate-page.ts](../../../tests/e2e/helpers/boc-manual-rate-page.ts) | 已审拆分：原XTS创建修改与手机删除；原SDK同源及独立凭证；关闭页面与精确回收 |
| [tests/e2e/helpers/boc-recalculation-lifecycle.ts](../../../tests/e2e/helpers/boc-recalculation-lifecycle.ts) | 已审保留：排空路由与关闭页面顺序；限定回收及明确回执；原正文/收尾多错误与附件 |
| [tests/e2e/helpers/boc-suite-fixture.ts](../../../tests/e2e/helpers/boc-suite-fixture.ts) | 已审保留：串行环境生命周期；实际Edge响应登记与透传；关闭页面后捕获及附件 |
| [tests/e2e/helpers/boc-suite-guard.ts](../../../tests/e2e/helpers/boc-suite-guard.ts) | 已审保留：校验专属DB/Kong与工作目录；复用Edge挂载核验；验证原SDK地址 |
| [tests/e2e/helpers/business-parameter-data.ts](../../../tests/e2e/helpers/business-parameter-data.ts) | 已审拆分：本地管理员能力前提；参数版本读取与恢复；订单读取与清理 |
| [tests/e2e/helpers/business-parameter-order-page.ts](../../../tests/e2e/helpers/business-parameter-order-page.ts) | 已审拆分：参数发布页面步骤；订单新建页面步骤；订单结汇页面步骤 |
| [tests/e2e/helpers/client-business-fixture.ts](../../../tests/e2e/helpers/client-business-fixture.ts) | 已审拆分：临时客户身份准备；客户与授权独立读回；限定清理和不存在凭证 |
| [tests/e2e/helpers/commission-merge-fixture.ts](../../../tests/e2e/helpers/commission-merge-fixture.ts) | 已审保留：专属报价/订单/故障生命周期；按依赖顺序回收与未知结果保留；testInfo归属证据输出 |
| [tests/e2e/helpers/company-expense-fixture.ts](../../../tests/e2e/helpers/company-expense-fixture.ts) | 已审拆分：费用独立读回；专属费用清理 |
| [tests/e2e/helpers/company-template-access-cases.ts](../../../tests/e2e/helpers/company-template-access-cases.ts) | 已审保留：七岗位入口及公告关闭；客户页面/API拒绝与无记录；手机工作栏入口边界 |
| [tests/e2e/helpers/company-template-actions.ts](../../../tests/e2e/helpers/company-template-actions.ts) | 已审拆分：原本地管理员准入；统一导出 |
| [tests/e2e/helpers/company-template-case-lifecycle.ts](../../../tests/e2e/helpers/company-template-case-lifecycle.ts) | 已审保留：路由排空与页面关闭顺序；限定清理/恢复与明确回执；正文/收尾多错误及附件证据 |
| [tests/e2e/helpers/company-template-documents.ts](../../../tests/e2e/helpers/company-template-documents.ts) | 已审保留：位置弹窗操作；草稿及正式编号生命周期；独立文档凭证 |
| [tests/e2e/helpers/company-template-page-actions.ts](../../../tests/e2e/helpers/company-template-page-actions.ts) | 已审拆分：模板表单；稳定点击；布局检查 |
| [tests/e2e/helpers/company-template-payloads.ts](../../../tests/e2e/helpers/company-template-payloads.ts) | 已审拆分：合成文件与上传载荷；测试模板协议；内容摘要 |
| [tests/e2e/helpers/company-template-preview-cases.ts](../../../tests/e2e/helpers/company-template-preview-cases.ts) | 已审保留：正文GET加载/重试/通知边界；报价单图片/行列/计算/打印交互；脚本片段发布、就绪与刷新 |
| [tests/e2e/helpers/company-template-publication-cases.ts](../../../tests/e2e/helpers/company-template-publication-cases.ts) | 已审保留：发布/更新/指南/回退/停用页面流程；同ID重送及业务失败/断线页面断言 |
| [tests/e2e/helpers/company-template-records.ts](../../../tests/e2e/helpers/company-template-records.ts) | 已审拆分：模板与版本权威读取/计数；归属与影响数验证清理；UUID标记恢复及层级收尾 |
| [tests/e2e/helpers/company-template-security-cases.ts](../../../tests/e2e/helpers/company-template-security-cases.ts) | 已审保留：输入类型/大小/HTML及修订拒绝；原内容接口哈希故障的页面调度 |
| [tests/e2e/helpers/current-exchange-rate-fixture.ts](../../../tests/e2e/helpers/current-exchange-rate-fixture.ts) | 已审拆分：报价输入/初态和既有快照；全字段版本/引用保护清理；本地供应商不可用准入 |
| [tests/e2e/helpers/customer-alias-fixture.ts](../../../tests/e2e/helpers/customer-alias-fixture.ts) | 已审拆分：真实专属项目/API/暂停准入；UUID清单与独立读回的Playwright提供；显式page依赖、顺序收尾与错误保留 |
| [tests/e2e/helpers/date-control.ts](../../../tests/e2e/helpers/date-control.ts) | 已审保留：键盘日期输入与公开值核对；按可见控件打开日历 |
| [tests/e2e/helpers/design-system-auth.ts](../../../tests/e2e/helpers/design-system-auth.ts) | 已审拆分：认证页布局；首字段关联与可见控件高度；退出与认证路由识别 |
| [tests/e2e/helpers/design-system-controls.ts](../../../tests/e2e/helpers/design-system-controls.ts) | 已审拆分：主题令牌对比度；共享控件语义与焦点样式 |
| [tests/e2e/helpers/design-system-filters.ts](../../../tests/e2e/helpers/design-system-filters.ts) | 已审拆分：筛选控件层级与折叠态恢复 |
| [tests/e2e/helpers/design-system-governance.ts](../../../tests/e2e/helpers/design-system-governance.ts) | 已审拆分：可见控件高度；标准表单关联及焦点；页面溢出 |
| [tests/e2e/helpers/design-system-visual.ts](../../../tests/e2e/helpers/design-system-visual.ts) | 已审拆分：截图稳定与命名；页面与锚定浮层视口边界 |
| [tests/e2e/helpers/document-access.ts](../../../tests/e2e/helpers/document-access.ts) | 已审拆分：本地访问与身份读取；原页面登录编排 |
| [tests/e2e/helpers/document-explorer.ts](../../../tests/e2e/helpers/document-explorer.ts) | 已审拆分：资源管理器页面操作；独立创建凭证；限定清理委托 |
| [tests/e2e/helpers/document-file-receipts.ts](../../../tests/e2e/helpers/document-file-receipts.ts) | 已审拆分：文件记录凭证；Storage 对象核对；最小 PDF 夹具 |
| [tests/e2e/helpers/document-fixture-cleanup.ts](../../../tests/e2e/helpers/document-fixture-cleanup.ts) | 已审拆分：批次发起人身份核对；限定清理编排与凭证保存 |
| [tests/e2e/helpers/document-library-page.ts](../../../tests/e2e/helpers/document-library-page.ts) | 已审拆分：授权目录读取；编号路径导航与上传交互；视口/渲染基本核对 |
| [tests/e2e/helpers/document-library.ts](../../../tests/e2e/helpers/document-library.ts) | 已审拆分：测试文档能力导出 |
| [tests/e2e/helpers/document-write-lock.ts](../../../tests/e2e/helpers/document-write-lock.ts) | 已审拆分：文档专属项目准入；有界故障SQL执行；锁进程核心调度 |
| [tests/e2e/helpers/generic-template-fixture.ts](../../../tests/e2e/helpers/generic-template-fixture.ts) | 已审拆分：闭包状态恢复的合成文档 |
| [tests/e2e/helpers/governance-todo-database.ts](../../../tests/e2e/helpers/governance-todo-database.ts) | 已审拆分：专属环境准入；本批待办独立读取与精确删除 |
| [tests/e2e/helpers/home-editor-geometry.ts](../../../tests/e2e/helpers/home-editor-geometry.ts) | 已审拆分：五卡结构与可见尺寸；工具条与预览碰撞 |
| [tests/e2e/helpers/home-layout-persistence.ts](../../../tests/e2e/helpers/home-layout-persistence.ts) | 已审保留：布局身份尺寸及网格读取；刷新后布局一致性；真实鼠标拖动编排 |
| [tests/e2e/helpers/home-manager.ts](../../../tests/e2e/helpers/home-manager.ts) | 已审拆分：管理弹窗打开；页面默认布局重置 |
| [tests/e2e/helpers/home-resize-editor.ts](../../../tests/e2e/helpers/home-resize-editor.ts) | 已审拆分：编辑动效与减少动效；边缘提示；键盘调整入口与焦点 |
| [tests/e2e/helpers/home-resize-preview.ts](../../../tests/e2e/helpers/home-resize-preview.ts) | 已审拆分：真实鼠标缩放预览与松手结果 |
| [tests/e2e/helpers/home-widget-assertions.ts](../../../tests/e2e/helpers/home-widget-assertions.ts) | 已审拆分：卡片定位；尺寸与位置几何；页面与卡片溢出 |
| [tests/e2e/helpers/inventory-credit-pages.ts](../../../tests/e2e/helpers/inventory-credit-pages.ts) | 已审保留：客户提交与财务整批审核；延期与还款生命周期；刷新及状态筛选 |
| [tests/e2e/helpers/inventory-order-page-receipts.ts](../../../tests/e2e/helpers/inventory-order-page-receipts.ts) | 已审保留：精确订单定位；点击与目标响应关联；独立数据库凭证附件 |
| [tests/e2e/helpers/inventory-order-pages.ts](../../../tests/e2e/helpers/inventory-order-pages.ts) | 已审保留：管理员建单与筛选；业务员复用与维护商品；经理入口核对 |
| [tests/e2e/helpers/inventory-order-read-pages.ts](../../../tests/e2e/helpers/inventory-order-read-pages.ts) | 已审保留：已还清客户资格提示；手机订单与附件只读路径；布局度量 |
| [tests/e2e/helpers/local-postgres-query.ts](../../../tests/e2e/helpers/local-postgres-query.ts) | 已审拆分：专属目标及有界只读SQL；JSON记录数组凭证；SQL字符串转义 |
| [tests/e2e/helpers/local-supabase-admin.ts](../../../tests/e2e/helpers/local-supabase-admin.ts) | 受限：只登记路径，不读取内容。 |
| [tests/e2e/helpers/local-supabase.ts](../../../tests/e2e/helpers/local-supabase.ts) | 已审拆分：每次显式专属目标与真实Docker/API/暂停准入；有写能力的有界stdin SQL执行及错误脱敏；现行目标状态布尔查询 |
| [tests/e2e/helpers/logistics-assignment-case.ts](../../../tests/e2e/helpers/logistics-assignment-case.ts) | 已审保留：独占店铺生命周期；额外角色页面登记与失败收尾；本次testInfo证据附件 |
| [tests/e2e/helpers/logistics-fixture-time.ts](../../../tests/e2e/helpers/logistics-fixture-time.ts) | 已审保留：带时区的微秒时间解析 |
| [tests/e2e/helpers/logistics-page-assertions.ts](../../../tests/e2e/helpers/logistics-page-assertions.ts) | 已审保留：响应式溢出与挤压断言；独立分页响应与渲染顺序核对；上下文级本地同步隔离 |
| [tests/e2e/helpers/logistics-paging-oracle.ts](../../../tests/e2e/helpers/logistics-paging-oracle.ts) | 已审保留：验证独立物流夹具；精确分页身份和顺序核对 |
| [tests/e2e/helpers/logistics-source-fixture.ts](../../../tests/e2e/helpers/logistics-source-fixture.ts) | 已审拆分：专属生命周期协调；明确运行编号清单；分别收尾与错误合并 |
| [tests/e2e/helpers/mail-boundary-mock-server.ts](../../../tests/e2e/helpers/mail-boundary-mock-server.ts) | 已审拆分：模拟服务调度；扫描与 AI 输出；飞书通知假凭证 |
| [tests/e2e/helpers/mail-boundary-state.ts](../../../tests/e2e/helpers/mail-boundary-state.ts) | 已审拆分：模拟邮件状态与克隆 |
| [tests/e2e/helpers/mail-feishu-boundary.ts](../../../tests/e2e/helpers/mail-feishu-boundary.ts) | 已审拆分：飞书令牌模拟；身份响应与计数 |
| [tests/e2e/helpers/mail-feishu-save-fault.ts](../../../tests/e2e/helpers/mail-feishu-save-fault.ts) | 已审拆分：专属隔离实例的保存故障触发器事务装卸及结果核对 |
| [tests/e2e/helpers/mail-fixture-admin.ts](../../../tests/e2e/helpers/mail-fixture-admin.ts) | 已审拆分：固定邮件数据的环境准入；原管理员连接调度 |
| [tests/e2e/helpers/mail-fixture-agents.ts](../../../tests/e2e/helpers/mail-fixture-agents.ts) | 已审拆分：业务员发件资料；飞书合成绑定 |
| [tests/e2e/helpers/mail-fixture-identity.ts](../../../tests/e2e/helpers/mail-fixture-identity.ts) | 已审拆分：固定合成编号与加密材料 |
| [tests/e2e/helpers/mail-fixture-mailbox.ts](../../../tests/e2e/helpers/mail-fixture-mailbox.ts) | 已审拆分：邮箱记录准备；加密访问凭据准备；通知游标准备 |
| [tests/e2e/helpers/mail-fixture-messages.ts](../../../tests/e2e/helpers/mail-fixture-messages.ts) | 已审拆分：会话归属与主题；历史出站及收件人凭证；入站消息准备 |
| [tests/e2e/helpers/mail-fixture-records.ts](../../../tests/e2e/helpers/mail-fixture-records.ts) | 已审拆分：插入目标编号验证；独立查回验证；清理影响数与残留验证 |
| [tests/e2e/helpers/mail-fixture-reset.ts](../../../tests/e2e/helpers/mail-fixture-reset.ts) | 已审拆分：十九张邮件表的有序清理 |
| [tests/e2e/helpers/mail-fixture-scenarios.ts](../../../tests/e2e/helpers/mail-fixture-scenarios.ts) | 已审拆分：同时间分页夹具；陌生入站会话夹具；删除阻挡作业 |
| [tests/e2e/helpers/mail-fixtures.ts](../../../tests/e2e/helpers/mail-fixtures.ts) | 已审拆分：邮件基础数据准备调度 |
| [tests/e2e/helpers/mail-gmail-boundary.ts](../../../tests/e2e/helpers/mail-gmail-boundary.ts) | 已审拆分：发送编号及 SENT 凭证；入站 MIME 读取；附件下载与计数 |
| [tests/e2e/helpers/mail-inbound-task.ts](../../../tests/e2e/helpers/mail-inbound-task.ts) | 已审拆分：专属收件事件准备；本地任务触发；后台终态核对 |
| [tests/e2e/helpers/mail-oauth-boundary.ts](../../../tests/e2e/helpers/mail-oauth-boundary.ts) | 已审拆分：同意页与令牌分支；身份与 scope 模拟；watch 返回与超时模式 |
| [tests/e2e/helpers/mail-oauth-save-fault.ts](../../../tests/e2e/helpers/mail-oauth-save-fault.ts) | 已审拆分：专属隔离实例的保存故障触发器事务装卸及结果核对 |
| [tests/e2e/helpers/mail-test.ts](../../../tests/e2e/helpers/mail-test.ts) | 已审拆分：邮件自动夹具生命周期；原邮件登录步骤 |
| [tests/e2e/helpers/monthly-settlement-cards.ts](../../../tests/e2e/helpers/monthly-settlement-cards.ts) | 已审拆分：三岗位页面卡片；双宽度布局与截图；筛选及英文切换 |
| [tests/e2e/helpers/monthly-settlement-fixture.ts](../../../tests/e2e/helpers/monthly-settlement-fixture.ts) | 已审拆分：自有清单与上海日期；三岗位身份配置；客户订单及余额准备 |
| [tests/e2e/helpers/operator-reimbursement-fixture.ts](../../../tests/e2e/helpers/operator-reimbursement-fixture.ts) | 已审拆分：Playwright本次夹具及单worker边界；退出等待请求并停止页面；准确清理回执和独占附件 |
| [tests/e2e/helpers/order-filter-visibility.ts](../../../tests/e2e/helpers/order-filter-visibility.ts) | 已审保留：筛选就绪与展开 |
| [tests/e2e/helpers/recalculation-preview-response.ts](../../../tests/e2e/helpers/recalculation-preview-response.ts) | 已审保留：点击前订阅精确POST响应；HTTP成功和本次UUID校验 |
| [tests/e2e/helpers/reimbursement-sharing-fixture.ts](../../../tests/e2e/helpers/reimbursement-sharing-fixture.ts) | 已审保留：逐场景独占数据和单worker约束；释放/排空/关闭/回收的顺序；正文与多项收尾错误/附件证据 |
| [tests/e2e/helpers/reimbursement-sharing-pages.ts](../../../tests/e2e/helpers/reimbursement-sharing-pages.ts) | 已审保留：原读取/溢出页面断言；并发信号及统一释放闸门 |
| [tests/e2e/helpers/sales-lead-conversion-fixture.ts](../../../tests/e2e/helpers/sales-lead-conversion-fixture.ts) | 已审拆分：真实身份与随机自有线索准备；完整版本确认与预声明编辑/故障保护；页面资源及逆序限定收尾 |
| [tests/e2e/helpers/sales-lead-conversion.ts](../../../tests/e2e/helpers/sales-lead-conversion.ts) | 已审拆分：原页面动作协调；提交前登记及提交后绑定清单；独立凭证与限定收尾入口 |
| [tests/e2e/helpers/select-control.ts](../../../tests/e2e/helpers/select-control.ts) | 已审保留：用户选择与隐藏值断言；动态选项读取；必要标签检查 |
| [tests/e2e/helpers/settlement-repair-page.ts](../../../tests/e2e/helpers/settlement-repair-page.ts) | 已审保留：专属环境及来源生命周期；原发布表单、分配入口及刷新；本次响应登记与部分失败路由 |
| [tests/e2e/helpers/template-draft-fixture.ts](../../../tests/e2e/helpers/template-draft-fixture.ts) | 已审拆分：自动环境准入；页面开草稿及真实owner/记录读取；排空页面后协调精确回收 |
| [tests/e2e/helpers/template-draft-lifecycle-cases.ts](../../../tests/e2e/helpers/template-draft-lifecycle-cases.ts) | 已审拆分：草稿创建/恢复/转正与另存副本；本人草稿可见范围与删除终态 |
| [tests/e2e/helpers/template-draft-navigation-case.ts](../../../tests/e2e/helpers/template-draft-navigation-case.ts) | 已审拆分：另存为目录导航和搜索；局部加载与原三宽度布局；取消后保留草稿及闸门释放 |
| [tests/e2e/helpers/template-draft-promotion-cases.ts](../../../tests/e2e/helpers/template-draft-promotion-cases.ts) | 已审拆分：同名与零影响转正拒绝；响应丢失及坏回执的原操作核对；本次故障目录的安装/精确移除编排 |
| [tests/e2e/helpers/template-draft-recovery-cases.ts](../../../tests/e2e/helpers/template-draft-recovery-cases.ts) | 已审拆分：旧窗口与新修订冲突；行锁超时和同操作重试；断网/在线恢复与独立凭证 |
| [tests/e2e/helpers/user-media-operation-verifier.ts](../../../tests/e2e/helpers/user-media-operation-verifier.ts) | 已审保留：原运营独立认证接线；公开运行终态/结果证明；local会话撤销及双错误保留 |
| [tests/e2e/helpers/user-media-owned-store.ts](../../../tests/e2e/helpers/user-media-owned-store.ts) | 已审保留：专属身份及SDK/API接线；SQL完整图与锁内版本回收；Storage真实下载/LIST/API删除 |
| [tests/e2e/helpers/wholesale-direct-usd-settlement.ts](../../../tests/e2e/helpers/wholesale-direct-usd-settlement.ts) | 已审拆分：原USD分批请求和报价锚点；独立整数金额/汇总期望；完整明细/订单/提成终态核对 |
| [tests/e2e/helpers/wholesale-fee-commission-fault.ts](../../../tests/e2e/helpers/wholesale-fee-commission-fault.ts) | 已审保留：冻结故障写入和恢复凭证；单字段受控故障及精确恢复；待恢复状态及全部错误保留 |
| [tests/e2e/helpers/wholesale-fee-customer-fixture.ts](../../../tests/e2e/helpers/wholesale-fee-customer-fixture.ts) | 已审拆分：客户及档案初态绑定；专属新旧客户准备；完整版本限定回收 |
| [tests/e2e/helpers/wholesale-fee-database.ts](../../../tests/e2e/helpers/wholesale-fee-database.ts) | 已审拆分：订单/参数/客户档案完整读取；版本保护清理和故障SQL生成；自有Storage完整前缀只读目录 |
| [tests/e2e/helpers/wholesale-fee-order-fixture.ts](../../../tests/e2e/helpers/wholesale-fee-order-fixture.ts) | 已审拆分：三种明确原输入样本；创建请求和完整初态绑定；完整版本清理及未知终态保护 |
| [tests/e2e/helpers/wholesale-fee-order-page.ts](../../../tests/e2e/helpers/wholesale-fee-order-page.ts) | 已审拆分：费用表单与订单行交互；订单写入及凭证编排；页面错误与专属截图 |
| [tests/e2e/helpers/wholesale-fee-order-transitions.ts](../../../tests/e2e/helpers/wholesale-fee-order-transitions.ts) | 已审拆分：通用预登记恢复与版本校验；原CNY结汇账务核对；原成本修改/审计与提成核对 |
| [tests/e2e/helpers/wholesale-fee-page-route.ts](../../../tests/e2e/helpers/wholesale-fee-page-route.ts) | 已审拆分：路由正文及收尾错误聚合；原写请求转发和待决计数 |
| [tests/e2e/helpers/wholesale-fee-parameter-fixture.ts](../../../tests/e2e/helpers/wholesale-fee-parameter-fixture.ts) | 已审保留：原请求与完整发布凭证绑定；有锁的原子恢复SQL；提交后独立读回与重复收尾 |
| [tests/e2e/helpers/wholesale-fee-parameter-page.ts](../../../tests/e2e/helpers/wholesale-fee-parameter-page.ts) | 已审拆分：参数表单及确认弹窗交互；三类回执故障与原请求登记；发布及刷新版本凭证核对 |
| [tests/e2e/helpers/wholesale-mutation-failure-scope.ts](../../../tests/e2e/helpers/wholesale-mutation-failure-scope.ts) | 已审拆分：声明失败请求与读取边界；只读批发/对象摘要；自动生命周期和错误聚合 |
| [tests/e2e/helpers/wholesale-order-attachment-capability.ts](../../../tests/e2e/helpers/wholesale-order-attachment-capability.ts) | 已审拆分：本地项目边界核验；原浏览器请求能力捕获；同项目Auth身份确认与缓存 |
| [tests/e2e/helpers/wholesale-order-attachment-fixture.ts](../../../tests/e2e/helpers/wholesale-order-attachment-fixture.ts) | 已审拆分：预声明上传与字节凭证；登记回执和完整图版本核对；限定删除与待决保护 |
| [tests/e2e/helpers/wholesale-order-attachment-page.ts](../../../tests/e2e/helpers/wholesale-order-attachment-page.ts) | 已审拆分：真实附件输入与页面夹具；精确端点转发和回收编排；自有订单定位与删除交互 |
| [tests/e2e/helpers/wholesale-order-attachment-sharing.ts](../../../tests/e2e/helpers/wholesale-order-attachment-sharing.ts) | 已审拆分：管理员上传与客户共享编排；客户下载/隐私和手机断言；两会话及夹具生命周期 |
| [tests/e2e/helpers/wholesale-release-page.ts](../../../tests/e2e/helpers/wholesale-release-page.ts) | 已审保留：专属项目与页面生命周期；本次发布取消及故障路由；分配字段与触控布局 |
| [tests/e2e/helpers/wholesale-settlement-fixtures.ts](../../../tests/e2e/helpers/wholesale-settlement-fixtures.ts) | 已审拆分：收款清理转交；自有USD报价生命周期；有效分配合计核对 |
| [tests/e2e/helpers/workspace-page-contracts.ts](../../../tests/e2e/helpers/workspace-page-contracts.ts) | 已审保留：固定业务标题与控件约定；正文与错误状态检查；手机共享筛选区展开 |
| [tests/e2e/home-role-task-counts.spec.ts](../../../tests/e2e/home-role-task-counts.spec.ts) | 已审保留：各岗位数据库计数范围；首页数字与导航核对；角色间会话退出 |
| [tests/e2e/information-hierarchy.spec.ts](../../../tests/e2e/information-hierarchy.spec.ts) | 已审保留：页头/无障碍命名及必要标题层级；多宽度摘要/卡片/首屏几何；专属执行与明确来源边界 |
| [tests/e2e/legacy-tourism-disabled.spec.ts](../../../tests/e2e/legacy-tourism-disabled.spec.ts) | 已审保留：停用说明和主动退出边界；已启用批发角色和导航；已停用业务接口及手机展示 |
| [tests/e2e/loading-feedback.spec.ts](../../../tests/e2e/loading-feedback.spec.ts) | 已审拆分：邮件查询等待；模拟剪贴板等待 |
| [tests/e2e/mail-feishu-oauth.spec.ts](../../../tests/e2e/mail-feishu-oauth.spec.ts) | 已审拆分：组织授权、失败和重复/中断原场景；从真实页面按钮进入并核对显示和刷新；独立核对授权状态及凭据/绑定记录 |
| [tests/e2e/mail-inbound.spec.ts](../../../tests/e2e/mail-inbound.spec.ts) | 已审拆分：已联系来信路由；陌生来信忽略与幂等 |
| [tests/e2e/mail-layout.spec.ts](../../../tests/e2e/mail-layout.spec.ts) | 已审保留：邮件三个视口与栏目溢出检查 |
| [tests/e2e/mail-numbered-pages.spec.ts](../../../tests/e2e/mail-numbered-pages.spec.ts) | 已审拆分：活动和隔离分页；末页删除恢复；本例编号清理 |
| [tests/e2e/mail-oauth.spec.ts](../../../tests/e2e/mail-oauth.spec.ts) | 已审拆分：组织授权、失败和重复/中断原场景；从真实页面按钮进入并核对显示和刷新；独立核对授权状态及凭据/绑定记录 |
| [tests/e2e/mail-outbound.spec.ts](../../../tests/e2e/mail-outbound.spec.ts) | 已审拆分：回复建议与发信凭证；附件发送凭证；管理员首次发件建档 |
| [tests/e2e/mail-permissions.spec.ts](../../../tests/e2e/mail-permissions.spec.ts) | 已审拆分：邮件入口岗位矩阵 |
| [tests/e2e/mail-quarantine.spec.ts](../../../tests/e2e/mail-quarantine.spec.ts) | 已审拆分：隔离与恢复；收件规则；副本删除与零影响 |
| [tests/e2e/mail-recipient-maintenance.spec.ts](../../../tests/e2e/mail-recipient-maintenance.spec.ts) | 已审保留：原管理员页面准备；维护任务请求；陌生会话清理凭证旅程 |
| [tests/e2e/mail-secondary-data.spec.ts](../../../tests/e2e/mail-secondary-data.spec.ts) | 已审拆分：人员资料失败与转交恢复；统计延迟与重试 |
| [tests/e2e/mail-sender-settings.spec.ts](../../../tests/e2e/mail-sender-settings.spec.ts) | 已审拆分：本人设置与越权拒绝；管理员管理发件资料 |
| [tests/e2e/mail-workspace-actions.spec.ts](../../../tests/e2e/mail-workspace-actions.spec.ts) | 已审拆分：核心输入区域布局；负责人转交；管理员分析与副本删除 |
| [tests/e2e/mail.spec.ts](../../../tests/e2e/mail.spec.ts) | 已审拆分：草稿保留；地址与正文拒绝后重试 |
| [tests/e2e/motion.spec.ts](../../../tests/e2e/motion.spec.ts) | 已审拆分：工作台菜单层叠与退出；待办列表重排；手机密集内容宽度 |
| [tests/e2e/operator-reimbursements-sharing.spec.ts](../../../tests/e2e/operator-reimbursements-sharing.spec.ts) | 已审拆分：原八个共享/历史页面场景的调度与断言；搜索/删除并发及权限/布局的页面边界；写入后的完整凭证与刷新调度 |
| [tests/e2e/operator-reimbursements.spec.ts](../../../tests/e2e/operator-reimbursements.spec.ts) | 已审拆分：新增与确认历史周期的页面操作/刷新；零影响回执的错误与原记录保持；财务访问边界及手机布局 |
| [tests/e2e/order-date-range.spec.ts](../../../tests/e2e/order-date-range.spec.ts) | 已审拆分：订单上海日期与快捷范围的纯函数合同；普通订单筛选规范化合同；每用例冻结与恢复测试时钟 |
| [tests/e2e/order-list-framework.spec.ts](../../../tests/e2e/order-list-framework.spec.ts) | 已审拆分：订单与物流统一工具条、布局和日期页面场景；有界翻页及末页就绪判定；共用范围定位与几何断言 |
| [tests/e2e/permissions.spec.ts](../../../tests/e2e/permissions.spec.ts) | 已审保留：岗位根路径及功能准入；启用业务与拒绝表现；拒绝后返回本人会话 |
| [tests/e2e/profile-operation-receipts.spec.ts](../../../tests/e2e/profile-operation-receipts.spec.ts) | 已审保留：固定账号场景的专属目标准入；原页面零回执/写后刷新失败与独立字段凭证；本次条件恢复与资源/主体错误保留 |
| [tests/e2e/public-redirects.spec.ts](../../../tests/e2e/public-redirects.spec.ts) | 已审保留：未登录入口；权限提示路由；转发来源边界 |
| [tests/e2e/referral-tree-company-branch.spec.ts](../../../tests/e2e/referral-tree-company-branch.spec.ts) | 已审拆分：客户推荐目录及公司路径断言；桌面与390px宽度核对 |
| [tests/e2e/registration-wizard.spec.ts](../../../tests/e2e/registration-wizard.spec.ts) | 已审保留：向导步骤与资料往返；邀请读取及启用业务反馈；语言Cookie与手机展示 |
| [tests/e2e/removed-admin-panels.spec.ts](../../../tests/e2e/removed-admin-panels.spec.ts) | 已审拆分：保留导航与助手入口检查；移除入口/读取及原地址合同；双语多宽度证据记录 |
| [tests/e2e/review-center-entrypoint.spec.ts](../../../tests/e2e/review-center-entrypoint.spec.ts) | 已审保留：管理员全局导航和页面入口；桌面/手机布局断言 |
| [tests/e2e/sales-lead-admin-claim.spec.ts](../../../tests/e2e/sales-lead-admin-claim.spec.ts) | 已审拆分：原规则和页面业务场景；专属自有数据与完整凭证；上下文及数据错误收尾 |
| [tests/e2e/sales-lead-conversion.spec.ts](../../../tests/e2e/sales-lead-conversion.spec.ts) | 已审拆分：原转换表单/双语与客户页交互；原网络/权限/期限故障表现；独立凭证和刷新断言 |
| [tests/e2e/sales-lead-daily-limit.spec.ts](../../../tests/e2e/sales-lead-daily-limit.spec.ts) | 已审拆分：原页面第5/6次及双语响应场景；随机六条准备与独立完整凭证；页面关闭及逆序回收错误保留 |
| [tests/e2e/sales-lead-details.spec.ts](../../../tests/e2e/sales-lead-details.spec.ts) | 已审拆分：字段与安全联系方式显示核对；响应替换及局部布局诊断；专属准入与截图证据归属 |
| [tests/e2e/sales-lead-views.spec.ts](../../../tests/e2e/sales-lead-views.spec.ts) | 已审拆分：视图切换与查询状态保持；极端资料与存储替身呈现；专属准入与局部布局/截图证据 |
| [tests/e2e/sales-leads.spec.ts](../../../tests/e2e/sales-leads.spec.ts) | 已审拆分：专属准入与本次线索生命周期；原页面场景与独立完整凭证；上下文和数据收尾错误保留 |
| [tests/e2e/select-control.spec.ts](../../../tests/e2e/select-control.spec.ts) | 已审保留：键盘/弹窗分层焦点交互；手机选项触控和溢出；共用Select公开值合同 |
| [tests/e2e/settlement-rate-repair-receipts.spec.ts](../../../tests/e2e/settlement-rate-repair-receipts.spec.ts) | 已审拆分：原管理员两场景调度；分配重试及刷新断言 |
| [tests/e2e/stale-navigation-recovery.spec.ts](../../../tests/e2e/stale-navigation-recovery.spec.ts) | 已审保留：正常与闲置导航方式；桌面/手机文档请求及溢出 |
| [tests/e2e/template-drafts.spec.ts](../../../tests/e2e/template-drafts.spec.ts) | 已审拆分：保持原七个场景顺序注册；使用自动专属环境准入与视频配置 |
| [tests/e2e/user-media-operation-receipts.spec.ts](../../../tests/e2e/user-media-operation-receipts.spec.ts) | 已审拆分：原两个页面场景编排；原凭据提供器与独立能力调度；请求/正文/收尾错误与附件编排 |
| [tests/e2e/wholesale-commission-merge.spec.ts](../../../tests/e2e/wholesale-commission-merge.spec.ts) | 已审拆分：十个页面场景与岗位范围；独立金额及结算终态断言；生命周期与输出编排 |
| [tests/e2e/wholesale-customer-commission-fees.spec.ts](../../../tests/e2e/wholesale-customer-commission-fees.spec.ts) | 已审拆分：六项业务场景及权限断言；专属夹具生命周期编排；页面刷新与只读凭证核对 |
| [tests/e2e/wholesale-customer-management.spec.ts](../../../tests/e2e/wholesale-customer-management.spec.ts) | 已审保留：固定客户键盘/手机/拒绝删除与两角色CRUD页面场景；真实ID/字段/修订与刷新/零残留独立凭证；专属执行前置及本文件的定位/只读查询辅助 |
| [tests/e2e/wholesale-customer-other-names.spec.ts](../../../tests/e2e/wholesale-customer-other-names.spec.ts) | 已审拆分：原两场景页面调度；从页面创建本次客户；刷新与手机可用性 |
| [tests/e2e/wholesale-logistics-lifecycle.spec.ts](../../../tests/e2e/wholesale-logistics-lifecycle.spec.ts) | 已审保留：真实角色页面中途失败场景；独立关闭与上下文剩余核对 |
| [tests/e2e/wholesale-logistics-sync.spec.ts](../../../tests/e2e/wholesale-logistics-sync.spec.ts) | 已审拆分：页面发起续跑刷新与独立记录；三终态反例；声明源网络与失败收尾 |
| [tests/e2e/wholesale-logistics.spec.ts](../../../tests/e2e/wholesale-logistics.spec.ts) | 已审拆分：原八页面场景与岗位范围；独立归属凭证与刷新断言；命名夹具与辅助函数编排 |
| [tests/e2e/wholesale-mutation-failures.spec.ts](../../../tests/e2e/wholesale-mutation-failures.spec.ts) | 已审拆分：原四组失败保留输入场景；原表单/选项交互助手；共享月份及响应式检查 |
| [tests/e2e/wholesale-navigation-order.spec.ts](../../../tests/e2e/wholesale-navigation-order.spec.ts) | 已审拆分：岗位/双语导航独立预期；前三入口实际跳转和手机布局；移除地址HTTP合同 |
| [tests/e2e/wholesale-order-attachment-receipts.spec.ts](../../../tests/e2e/wholesale-order-attachment-receipts.spec.ts) | 已审拆分：正向页面最终凭证场景；未知登记手机错误场景；专属夹具生命周期调度 |
| [tests/e2e/wholesale-order-compact-view.spec.ts](../../../tests/e2e/wholesale-order-compact-view.spec.ts) | 已审拆分：常用/完整列切换；上海月份单号定位 |
| [tests/e2e/wholesale-order-creation-idempotency.spec.ts](../../../tests/e2e/wholesale-order-creation-idempotency.spec.ts) | 已审拆分：专属准入及夹具生命周期；重复提交与刷新时序场景；原表单和移动宽度断言 |
| [tests/e2e/wholesale-order-date-client.spec.ts](../../../tests/e2e/wholesale-order-date-client.spec.ts) | 已审保留：本进程时钟生命周期；订单/评估日期参数；物流默认及请求参数 |
| [tests/e2e/wholesale-order-link-options.spec.ts](../../../tests/e2e/wholesale-order-link-options.spec.ts) | 已审保留：真实选项格式断言；稳定排序及输入不变；固定独立选项构造 |
| [tests/e2e/wholesale-order-month-filter.spec.ts](../../../tests/e2e/wholesale-order-month-filter.spec.ts) | 已审拆分：页面月份筛选与独立数量；客户上下文入口及回收；可见摘要与响应式断言 |
| [tests/e2e/wholesale-order-pagination.spec.ts](../../../tests/e2e/wholesale-order-pagination.spec.ts) | 已审拆分：固定只读种子与分页断言；多角色列表/移动和失败场景；附件共享场景调度 |
| [tests/e2e/wholesale-order-settlements.spec.ts](../../../tests/e2e/wholesale-order-settlements.spec.ts) | 已审拆分：原两场景及专属生命周期编排；原表单和结汇页面交互；只读种子和响应式检查 |
| [tests/e2e/wholesale-orders-i18n.spec.ts](../../../tests/e2e/wholesale-orders-i18n.spec.ts) | 已审保留：390px英文交互；筛选文案；横向溢出断言 |
| [tests/e2e/wholesale-salesman-collaboration.spec.ts](../../../tests/e2e/wholesale-salesman-collaboration.spec.ts) | 已审拆分：原协作入口与角色/视口矩阵；局部文本/溢出/当前编号助手；专属准入与手动context资源 |
| [tests/e2e/wholesale-settlement-monthly-summary.spec.ts](../../../tests/e2e/wholesale-settlement-monthly-summary.spec.ts) | 已审拆分：缺价月度页面场景；精确缺价日期选择；已登记资源及失败收尾 |
| [tests/e2e/wholesale-settlement-monthly-unallocated.spec.ts](../../../tests/e2e/wholesale-settlement-monthly-unallocated.spec.ts) | 已审拆分：原月度页面场景调度；准备及卡片辅助调用；主体与收尾错误保留 |
| [tests/e2e/wholesale-settlement-releases.spec.ts](../../../tests/e2e/wholesale-settlement-releases.spec.ts) | 已审拆分：原财务与业务员场景；逐阶段分配及冲销；刷新和布局 |
| [tests/e2e/workspace-entrypoints.spec.ts](../../../tests/e2e/workspace-entrypoints.spec.ts) | 已审保留：岗位/路径入口及独立页面合同；复制、筛选、弹窗和人员入口的局部显示交互；专属准入/来源阻断及日期几何辅助 |
| [tests/e2e/workspace-navigation-search.spec.ts](../../../tests/e2e/workspace-navigation-search.spec.ts) | 已审拆分：菜单匹配与键盘清空；导航和刷新复位；多视口几何及可见性 |
| [tests/e2e/workspace-navigation-visible.spec.ts](../../../tests/e2e/workspace-navigation-visible.spec.ts) | 已审拆分：桌面对齐和全部可见入口；跳转及刷新保持；手机菜单展开 |
| [tests/learning/admin-account-receipts.spec.ts](../../../tests/learning/admin-account-receipts.spec.ts) | 已审拆分：从页面发起账号调整与重试；独立核对账号、Auth 与审计；限定清理专属记录 |
| [tests/learning/admin-review-receipts.spec.ts](../../../tests/learning/admin-review-receipts.spec.ts) | 已审拆分：建立专属申请或媒体夹具；验证页面审核、最终凭证与刷新；清理本次记录及文件 |
| [tests/learning/announcement-admin.spec.ts](../../../tests/learning/announcement-admin.spec.ts) | 已审保留：通过管理员页面执行公告生命周期；核对独立记录、版本和清理 |
| [tests/learning/announcement-read.spec.ts](../../../tests/learning/announcement-read.spec.ts) | 已审保留：通过真实顶栏执行确认与重试；记录数据库终态和同一版本不重写 |
| [tests/learning/assistant-chat-stream.spec.ts](../../../tests/learning/assistant-chat-stream.spec.ts) | 已审拆分：准备专属模拟供应商；页面发起和独立凭证核对；清理专属账本与额度 |
| [tests/learning/auth-mail-fixture.mjs](../../../tests/learning/auth-mail-fixture.mjs) | 已审拆分：本项目邮件准入和专属邮件生命周期；独立Auth记录读取；原表摘要与限定清理核对 |
| [tests/learning/auth-password-diagnostics.ts](../../../tests/learning/auth-password-diagnostics.ts) | 已审拆分：浏览器观测；具体故障归因断言 |
| [tests/learning/auth-password-maintenance.spec.ts](../../../tests/learning/auth-password-maintenance.spec.ts) | 已审拆分：专属场景和浏览器故障调度；页面到独立凭据验收；资源回收和验收凭证 |
| [tests/learning/business-parameter-percent.spec.ts](../../../tests/learning/business-parameter-percent.spec.ts) | 已审保留：从真实双语页面校验输入与预览；拦截共享库写请求并核对载荷和原始摘要 |
| [tests/learning/business-vip-receipts.spec.ts](../../../tests/learning/business-vip-receipts.spec.ts) | 已审保留：VIP 写入凭证和断线回归；客户权限拒绝回归 |
| [tests/learning/company-expense-recovery.spec.ts](../../../tests/learning/company-expense-recovery.spec.ts) | 已审保留：从双语页面执行真实费用写入并注入断线；独立核对费用编号、版本和清理；验证业务员权限 |
| [tests/learning/company-template-draft-promotion.spec.ts](../../../tests/learning/company-template-draft-promotion.spec.ts) | 已审拆分：准备并清理本次合成模板和专属账号数据；从页面验证转正、正式保存和另存为；独立核对版本、指纹、权限和刷新 |
| [tests/learning/company-template-publication.spec.ts](../../../tests/learning/company-template-publication.spec.ts) | 已审拆分：页面发布及管理回归；独立数据库和夹具清理 |
| [tests/learning/customer-document-upload-fixture.ts](../../../tests/learning/customer-document-upload-fixture.ts) | 已审拆分：准备及读取专属客户目录、模板和文件；独立下载对象字节；限定回收并核对失败后清理 |
| [tests/learning/customer-document-upload-lock.ts](../../../tests/learning/customer-document-upload-lock.ts) | 已审保留：准备专属资料行的有界锁；确认数据库请求等待关系并释放 |
| [tests/learning/customer-inventory-attachment-recovery.spec.ts](../../../tests/learning/customer-inventory-attachment-recovery.spec.ts) | 已审保留：从页面复现登记回执丢失；独立核对附件、删除与限定清理 |
| [tests/learning/dashboard-dialog-layers.spec.ts](../../../tests/learning/dashboard-dialog-layers.spec.ts) | 已审保留：订单草稿弹窗交互 |
| [tests/learning/dashboard-home-layout.spec.ts](../../../tests/learning/dashboard-home-layout.spec.ts) | 已审保留：真实布局交互；独立数据库读回及刷新断言；双语响应式证据 |
| [tests/learning/dashboard-home-todo.spec.ts](../../../tests/learning/dashboard-home-todo.spec.ts) | 已审保留：首页待办写入及失败验收 |
| [tests/learning/date-picker-readonly.spec.ts](../../../tests/learning/date-picker-readonly.spec.ts) | 已审保留：只读日期快捷键回归 |
| [tests/learning/document-library-archive-download.spec.ts](../../../tests/learning/document-library-archive-download.spec.ts) | 已审保留：由资料库页面上传和下载专属文件；注入失败并核对实际 ZIP 条目、刷新和未登录限制；清理本次资料和证据 |
| [tests/learning/document-library-batch-interruption.spec.ts](../../../tests/learning/document-library-batch-interruption.spec.ts) | 已审拆分：从真实页面发起复制和删除及中断；独立核对数据库、对象与刷新终态；保存凭证并限定清理 |
| [tests/learning/document-library-batch-move.spec.ts](../../../tests/learning/document-library-batch-move.spec.ts) | 已审拆分：缺失对象移动与原批次续办验收；按编号的双语/双宽度导航验收；文档夹具生命周期与最终凭证 |
| [tests/learning/document-library-batch-upload-recovery.spec.ts](../../../tests/learning/document-library-batch-upload-recovery.spec.ts) | 已审保留：验证批量上传中的逐项断线恢复；验证撤回目录权限后的旧操作拒绝；独立核对并清理本次数据 |
| [tests/learning/document-library-preview.spec.ts](../../../tests/learning/document-library-preview.spec.ts) | 已审保留：通过页面上传、改名、预览和重试专属文件；比较本地对象、页面、角色权限和刷新；清理夹具并保存证据 |
| [tests/learning/document-library-upload-recovery.spec.ts](../../../tests/learning/document-library-upload-recovery.spec.ts) | 已审保留：从页面重送一次上传；刷新后用原编号继续核对；核对实际对象和清理 |
| [tests/learning/exchange-rate-manual.spec.ts](../../../tests/learning/exchange-rate-manual.spec.ts) | 已审拆分：通过页面维护专属报价；独立核对目标与数值；验证异常并清理夹具 |
| [tests/learning/exchange-rate-sync-receipt.spec.ts](../../../tests/learning/exchange-rate-sync-receipt.spec.ts) | 已审拆分：核对财务只读入口；从页面触发当天及历史回执；独立核对和清理合成报价 |
| [tests/learning/fixtures.ts](../../../tests/learning/fixtures.ts) | 已审拆分：按角色提供本地专属身份；独立清理并核对账号与关联记录 |
| [tests/learning/mail-oauth-failure.spec.ts](../../../tests/learning/mail-oauth-failure.spec.ts) | 已审拆分：驱动真实页面发起授权与失败回跳；独立核对一次领取、零邮箱修改及拒绝未验证推送；清理专属授权和本机供应商进程 |
| [tests/learning/mail-quarantine-flow.spec.ts](../../../tests/learning/mail-quarantine-flow.spec.ts) | 已审拆分：创建专属会话与联系凭证；从真实页面核对隔离、恢复与失败场景；独立查询并限定清理 |
| [tests/learning/mail-reply-draft-verification.ts](../../../tests/learning/mail-reply-draft-verification.ts) | 已审拆分：建议迟到与人工编辑回归；本地供应商模拟和账本核对 |
| [tests/learning/mail-sender-profile.spec.ts](../../../tests/learning/mail-sender-profile.spec.ts) | 已审拆分：准备和定位两角色的发件设置；验证错误回执、连击、权限和刷新；保存专属版本证据 |
| [tests/learning/mail-thread-workflow.spec.ts](../../../tests/learning/mail-thread-workflow.spec.ts) | 已审拆分：准备两条专属会话；调度状态、草稿和转交验收；限定清理与保存凭证 |
| [tests/learning/mail-transfer-verification.ts](../../../tests/learning/mail-transfer-verification.ts) | 已审拆分：验证三角色看到的转交结果；检查暂时故障、回读和刷新 |
| [tests/learning/media-browser-diagnostics.ts](../../../tests/learning/media-browser-diagnostics.ts) | 已审拆分：媒体控制台分类与安全证据 |
| [tests/learning/media-object-collision.ts](../../../tests/learning/media-object-collision.ts) | 已审拆分：本次碰撞对象归属；真实 Storage 准备与独立核对；精确子对象回收 |
| [tests/learning/operation-run-receipts.spec.ts](../../../tests/learning/operation-run-receipts.spec.ts) | 已审拆分：从线索页面触发与重复点击；核对本地账本并模拟错配回执；刷新与专属清理 |
| [tests/learning/operator-reimbursement-recovery.spec.ts](../../../tests/learning/operator-reimbursement-recovery.spec.ts) | 已审保留：从双语真实页面发起新增与周期确认；注入网络中断并独立核对行版本；清理专属运营报销夹具 |
| [tests/learning/package.json](../../../tests/learning/package.json) | 已审保留：学习测试 ESM 模块边界 |
| [tests/learning/person-private-note.spec.ts](../../../tests/learning/person-private-note.spec.ts) | 已审拆分：用两位专属管理员执行页面操作；独立读回行和版本；验证失败并清理专属记录 |
| [tests/learning/playwright.config.ts](../../../tests/learning/playwright.config.ts) | 已审保留：独立学习浏览器测试配置 |
| [tests/learning/profile-invite-read.spec.ts](../../../tests/learning/profile-invite-read.spec.ts) | 已审保留：专属账号个人中心浏览器验收与限定清理 |
| [tests/learning/profile-maintenance.spec.ts](../../../tests/learning/profile-maintenance.spec.ts) | 已审拆分：管理员直接保存；员工申请和审核终态；双语响应式及清理凭证 |
| [tests/learning/profile-media.spec.ts](../../../tests/learning/profile-media.spec.ts) | 已审拆分：媒体页面完整流程调度；独立业务终态与诊断；专属夹具回收 |
| [tests/learning/register-progress.spec.ts](../../../tests/learning/register-progress.spec.ts) | 已审保留：注册实际步骤顺序回归；双语双宽度与刷新回归 |
| [tests/learning/sales-lead-receipts.spec.ts](../../../tests/learning/sales-lead-receipts.spec.ts) | 已审拆分：页面关键写入及独立凭证；账号与线索夹具生命周期 |
| [tests/learning/wholesale-attachment-access-fixture.ts](../../../tests/learning/wholesale-attachment-access-fixture.ts) | 已审保留：准备、独立核对和限定回收本次夹具，上传通过真实业务员页面完成；以真实页面身份核对Storage签名和下载内容；核对文件名各行的可见边界 |
| [tests/learning/wholesale-attachment-interruption-page.ts](../../../tests/learning/wholesale-attachment-interruption-page.ts) | 已审拆分：定位详情与附件表单；收集脱敏请求、错误和对应缺失响应；安装实际接口转发的故障 |
| [tests/learning/wholesale-client-business-add.spec.ts](../../../tests/learning/wholesale-client-business-add.spec.ts) | 已审保留：准备有档案及无档案的专属客户；从页面验证开通、异常回执和断线重试；独立确认授权与档案并清理 |
| [tests/learning/wholesale-commission-settlement.spec.ts](../../../tests/learning/wholesale-commission-settlement.spec.ts) | 已审保留：从真实页面触发提成结算并注入网络故障；独立核对记录版本和清理夹具；验证客户不能进入业务员提成标签 |
| [tests/learning/wholesale-customer-alias-concurrency.spec.ts](../../../tests/learning/wholesale-customer-alias-concurrency.spec.ts) | 已审保留：准备独立客户和账号；从两个浏览器会话操作真实写入；独立读回终态并清理 |
| [tests/learning/wholesale-customer-delete-fixtures.ts](../../../tests/learning/wholesale-customer-delete-fixtures.ts) | 已审保留：管理专属转换线索夹具；管理专属客户模板文档夹具 |
| [tests/learning/wholesale-customer-delete-protection.spec.ts](../../../tests/learning/wholesale-customer-delete-protection.spec.ts) | 已审保留：验证转换线索的档案删除入口；验证文件阻止删除和移除文件后的成功终态；保存浏览器和独立数据库凭证 |
| [tests/learning/wholesale-customer-delete-race.ts](../../../tests/learning/wholesale-customer-delete-race.ts) | 已审保留：创建专属的竞争删除事务；确认页面请求在等待后提交并回传结果 |
| [tests/learning/wholesale-customer-delete-recovery.spec.ts](../../../tests/learning/wholesale-customer-delete-recovery.spec.ts) | 已审保留：准备及清理专属客户；从页面验证删除断线与竞争请求；核对数据库与刷新结果 |
| [tests/learning/wholesale-customer-document-upload-race.spec.ts](../../../tests/learning/wholesale-customer-document-upload-race.spec.ts) | 已审保留：从真实页面验证两种请求顺序；核对数据库、Storage 字节与刷新；输出与清理凭证 |
| [tests/learning/wholesale-customer-edit-conflict.spec.ts](../../../tests/learning/wholesale-customer-edit-conflict.spec.ts) | 已审保留：准备本次专属客户和两个页面会话；制造旧表单冲突和真实提交回执丢失；通过数据库和刷新独立核对并清理 |
| [tests/learning/wholesale-customer-link-recovery.spec.ts](../../../tests/learning/wholesale-customer-link-recovery.spec.ts) | 已审保留：准备专属档案与注册账号；从页面模拟提交前和提交后断线；核对授权、版本、刷新和清理 |
| [tests/learning/wholesale-customer-record.spec.ts](../../../tests/learning/wholesale-customer-record.spec.ts) | 已审保留：为每个语言和视口准备专属管理员与客户；从页面走档案生命周期；读回和清理专属记录 |
| [tests/learning/wholesale-customer-referrals.spec.ts](../../../tests/learning/wholesale-customer-referrals.spec.ts) | 已审保留：客户筛选与推荐终态回归 |
| [tests/learning/wholesale-customer-role-matrix.spec.ts](../../../tests/learning/wholesale-customer-role-matrix.spec.ts) | 已审保留：按岗位准备专属账号和客户档案；验证页面能力及数据库权限；清理并保存凭证 |
| [tests/learning/wholesale-logistics-assignment-split.spec.ts](../../../tests/learning/wholesale-logistics-assignment-split.spec.ts) | 已审保留：从页面验证店铺归属和提交去重；独立核对区间、包裹和夹具清理 |
| [tests/learning/wholesale-order-assessment.spec.ts](../../../tests/learning/wholesale-order-assessment.spec.ts) | 已审保留：建立专属订单与账号上下文；模拟供应商并执行页面交互；独立核对与清理本次数据库记录 |
| [tests/learning/wholesale-order-attachment-interruption.spec.ts](../../../tests/learning/wholesale-order-attachment-interruption.spec.ts) | 已审拆分：编排六种故障及双语双宽度；核对记录、对象、字节、重复请求和刷新终态；保存失败现场及限定回收凭证 |
| [tests/learning/wholesale-order-attachments.spec.ts](../../../tests/learning/wholesale-order-attachments.spec.ts) | 已审拆分：准备与限定回收专属附件夹具；从页面编排原上传下载删除场景与传输观察；独立核对数据库、Storage和刷新结果 |
| [tests/learning/wholesale-order-client-scope.spec.ts](../../../tests/learning/wholesale-order-client-scope.spec.ts) | 已审拆分：编排八岗位与双语双宽度的真实页面验收；核对真实签名授权、下载及只读岗位拒绝写入；汇总独立凭证与限定清理结果 |
| [tests/learning/wholesale-order-create-recovery.spec.ts](../../../tests/learning/wholesale-order-create-recovery.spec.ts) | 已审拆分：订单页面故障与恢复；独立数据库核对和精确清理 |
| [tests/learning/wholesale-order-full-table.spec.ts](../../../tests/learning/wholesale-order-full-table.spec.ts) | 已审保留：在真实页面核对双语完整表格；独立读回各字段与版本并清理专属夹具 |
| [tests/learning/wholesale-order-settlement-recovery.spec.ts](../../../tests/learning/wholesale-order-settlement-recovery.spec.ts) | 已审拆分：结汇断线与并发回归；刷新和终态核对；专属夹具清理 |
| [tests/learning/wholesale-people-directory.spec.ts](../../../tests/learning/wholesale-people-directory.spec.ts) | 已审保留：人员目录键盘与只读回归；客户角色页面准入回归 |
| [tests/learning/wholesale-settlement-release-clear-recovery.spec.ts](../../../tests/learning/wholesale-settlement-release-clear-recovery.spec.ts) | 已审保留：从页面验证分配清空及断线；独立核对冲销、关联结汇、刷新及清理 |
| [tests/learning/wholesale-settlement-release-publication-recovery.spec.ts](../../../tests/learning/wholesale-settlement-release-publication-recovery.spec.ts) | 已审保留：模拟响应中断并执行页面发布恢复；独立核对写入凭证与按标记清理 |
| [tests/learning/wholesale-vip-access-fixture.ts](../../../tests/learning/wholesale-vip-access-fixture.ts) | 已审拆分：准备两个专属客户并保留本人关联档案；读取会员、收费、权限和实际日历年凭证；锁住准确范围、比较整行版本并限定回收 |
| [tests/learning/wholesale-vip-access.spec.ts](../../../tests/learning/wholesale-vip-access.spec.ts) | 已审拆分：编排八岗位及中英文桌面手机页面；核对真实令牌读取、页面写入与数据库终态；保留现场、截图及限定清理凭证 |
| [tests/learning/workspace-notice.spec.ts](../../../tests/learning/workspace-notice.spec.ts) | 已审拆分：旅游停用及批发入口验证；服务说明页角色与响应式验证 |
| [tests/public/legal-navigation.spec.ts](../../../tests/public/legal-navigation.spec.ts) | 已审保留：公开页导航回归 |
| [tests/public/login-recovery.spec.ts](../../../tests/public/login-recovery.spec.ts) | 已审保留：公开认证页面浏览器验收；独立截图证据 |
| [tests/public/playwright.config.ts](../../../tests/public/playwright.config.ts) | 已审保留：公共页独立发现；单浏览器本地配置 |
| [tests/test-support/assistant-settlement-case.ts](../../../tests/test-support/assistant-settlement-case.ts) | 已审保留：专属角色和业务范围；收款/客户/配额完整版本；未知提交与限定清理 |
| [tests/test-support/boc-manual-rate-case.ts](../../../tests/test-support/boc-manual-rate-case.ts) | 已审保留：XTS日期范围空检查和完整报价凭证；同编号/新xmin与只读不变核对；行锁CAS/全部引用/真实DELETE与未知结果 |
| [tests/test-support/boc-quote-job-case.ts](../../../tests/test-support/boc-quote-job-case.ts) | 已审保留：空范围和合成类型行；任务及报价的完整版本；按编号原子回收 |
| [tests/test-support/boc-recalculation-cohort.ts](../../../tests/test-support/boc-recalculation-cohort.ts) | 已审保留：九表空范围和唯一订单归属；预览/执行/不变的完整图及终态；锁内逐层真实删除与未知结果 |
| [tests/test-support/commission-merge-order.ts](../../../tests/test-support/commission-merge-order.ts) | 已审保留：自有订单及结汇事务准备；完整数据图及真实提成终态凭证；行版本/引用边界保护清理 |
| [tests/test-support/commission-merge-read-fault.ts](../../../tests/test-support/commission-merge-read-fault.ts) | 已审保留：专属真实读取故障安装；完整函数目录与版本归属核对；精确恢复及独立终态证据 |
| [tests/test-support/company-template-hash-fault.ts](../../../tests/test-support/company-template-hash-fault.ts) | 已审保留：原来源/编号/真实摘要与完整图核对；锁内注入/恢复及真实UPDATE1行；独立读回/未知结果/证据副本 |
| [tests/test-support/customer-alias-records.ts](../../../tests/test-support/customer-alias-records.ts) | 已审拆分：UUID清单；真实归属/名称/修订核对；精确删除与独立零残留 |
| [tests/test-support/disposable-fixture.ts](../../../tests/test-support/disposable-fixture.ts) | 已审拆分：本地夹具声明准入；专属容器/API关联校验；共用只读Docker/调度预检接线 |
| [tests/test-support/document-fixture-cleanup.ts](../../../tests/test-support/document-fixture-cleanup.ts) | 已审拆分：运行数据归属；回收顺序与失败传播；独立残留检查 |
| [tests/test-support/document-fixture-store.ts](../../../tests/test-support/document-fixture-store.ts) | 已审拆分：分页和影响集合读取；批次及对象回收；独立终态核对 |
| [tests/test-support/fixture-cleanup-sequence.ts](../../../tests/test-support/fixture-cleanup-sequence.ts) | 已审拆分：顺序尝试资源回收；聚合全部失败 |
| [tests/test-support/fixtures/wholesale-fee-proof-samples.json](../../../tests/test-support/fixtures/wholesale-fee-proof-samples.json) | 已审保留：合成订单初始凭证样本 |
| [tests/test-support/fixtures/wholesale-fee-transition-samples.json](../../../tests/test-support/fixtures/wholesale-fee-transition-samples.json) | 已审保留：分次结汇及改单的合成结果样本 |
| [tests/test-support/inventory-order-fixture-sql.ts](../../../tests/test-support/inventory-order-fixture-sql.ts) | 已审保留：八表快照 SQL；事务锁与版本比对；UUID 删除及行数凭证 |
| [tests/test-support/inventory-order-fixture.ts](../../../tests/test-support/inventory-order-fixture.ts) | 已审保留：隔离基线及订单范围；事务凭证认领；精确清理编排 |
| [tests/test-support/logistics-assignment-case.ts](../../../tests/test-support/logistics-assignment-case.ts) | 已审保留：唯一协作人及两表自有事务准备；完整行版本与真实归属变化确认；两表CAS清理及独立查零 |
| [tests/test-support/logistics-fixture-sql.ts](../../../tests/test-support/logistics-fixture-sql.ts) | 已审拆分：库内私有备份及准确准备；锁后归属与精确原子恢复；指纹及零残留独立读回 |
| [tests/test-support/logistics-fixture-store.ts](../../../tests/test-support/logistics-fixture-store.ts) | 已审拆分：API/DB/Edge实际准入；有界SQL与错误脱敏；准确回执及另一连接核对 |
| [tests/test-support/logistics-source-server.ts](../../../tests/test-support/logistics-source-server.ts) | 已审拆分：协议与两页本地数据；限流恢复及错误收集；监听与半个请求收尾 |
| [tests/test-support/loopback-http-boundary.ts](../../../tests/test-support/loopback-http-boundary.ts) | 已审拆分：模拟 HTTP 监听与回收；异步请求失败收尾；请求与响应 JSON 编解码 |
| [tests/test-support/mail-fixture-store.mjs](../../../tests/test-support/mail-fixture-store.mjs) | 已审拆分：纯模块白名单加载；SDK内存HTTP边界 |
| [tests/test-support/monthly-settlement-lifecycle.ts](../../../tests/test-support/monthly-settlement-lifecycle.ts) | 已审拆分：专属实际项目核验；精确删除及另请求读回；所有资源顺序收尾 |
| [tests/test-support/operator-reimbursement-fixture.ts](../../../tests/test-support/operator-reimbursement-fixture.ts) | 已审拆分：空周期/活跃身份准备及自有记录凭证；业务终态、版本和周期范围核对；锁后版本与实际行数清理及已核对证据副本 |
| [tests/test-support/owned-governance-todo.mjs](../../../tests/test-support/owned-governance-todo.mjs) | 已审拆分：专属记录归属核对；创建与正文生命周期；失败清理及双重错误保留 |
| [tests/test-support/postgres-document-lock.ts](../../../tests/test-support/postgres-document-lock.ts) | 已审拆分：文档锁SQL及输入约束；就绪消息与失败监测；有界且幂等的进程回收 |
| [tests/test-support/reimbursement-sharing-case.ts](../../../tests/test-support/reimbursement-sharing-case.ts) | 已审保留：UUID意图和两运营空范围的短事务准备；完整209条记录/版本及报销/删除凭证；锁内CAS/实际删除数量和独立查零 |
| [tests/test-support/sales-lead-conversion-cleanup-sql.ts](../../../tests/test-support/sales-lead-conversion-cleanup-sql.ts) | 已审拆分：真实联表读取与精确回查；锁后归属和原子清理；SQL输入与美元标签边界 |
| [tests/test-support/sales-lead-conversion-proof.ts](../../../tests/test-support/sales-lead-conversion-proof.ts) | 已审拆分：独立读取身份与完整转换凭证；页面前清单前提；实际客户/版本绑定 |
| [tests/test-support/sales-lead-conversion-store.ts](../../../tests/test-support/sales-lead-conversion-store.ts) | 已审拆分：专属API/DB物理准入；有界实际SQL传输；准确回执与另一连接终态 |
| [tests/test-support/settlement-fixture-cleanup-sql.ts](../../../tests/test-support/settlement-fixture-cleanup-sql.ts) | 已审拆分：输入及回执合同；锁定来源的原子删除；独立读回语句 |
| [tests/test-support/settlement-fixture-cleanup.ts](../../../tests/test-support/settlement-fixture-cleanup.ts) | 已审拆分：实际专属项目核验；有界执行与独立终态核对 |
| [tests/test-support/settlement-repair-case.ts](../../../tests/test-support/settlement-repair-case.ts) | 已审保留：唯一客户订单与阶段；当前收款及后台版本捕获；未知结果保护与精确回收 |
| [tests/test-support/settlement-repair-receipts.ts](../../../tests/test-support/settlement-repair-receipts.ts) | 已审保留：订单、客户与档案归属；派发与日末报价终态；分配、结汇及金额关联 |
| [tests/test-support/settlement-repair-sql.ts](../../../tests/test-support/settlement-repair-sql.ts) | 已审拆分：15个范围的完整版本读取；专属客户与订单准备；事务锁、外键与实际删除数 |
| [tests/test-support/shanghai-calendar.ts](../../../tests/test-support/shanghai-calendar.ts) | 已审拆分：上海日历投影；下一天与下一月计算 |
| [tests/test-support/template-document-fixture-cleanup.ts](../../../tests/test-support/template-document-fixture-cleanup.ts) | 已审拆分：文档夹具范围；精确影响数回收；最终残留核对 |
| [tests/test-support/template-draft-cleanup.ts](../../../tests/test-support/template-draft-cleanup.ts) | 已审拆分：限定ID/owner的完整快照；锁后版本与每表真实删除数；提交后独立查零及未知结果拒绝 |
| [tests/test-support/template-draft-insert-fault.ts](../../../tests/test-support/template-draft-insert-fault.ts) | 已审拆分：指定草稿唯一故障安装；完整目录版本匹配后移除；目录终态独立确认及未知结果拒绝 |
| [tests/test-support/user-media-owned-case.ts](../../../tests/test-support/user-media-owned-case.ts) | 已审保留：独占上传意图及目标持续登记；完整行/评估终态/对象内容凭证；分阶段回收与未知结果保留 |
| [tests/test-support/wholesale-fee-model.mjs](../../../tests/test-support/wholesale-fee-model.mjs) | 已审保留：当前完整模块的VM装配；明确SQL及固定时钟模型；同一订单阶段样本助手 |
| [tests/test-support/wholesale-order-attachment-model.mjs](../../../tests/test-support/wholesale-order-attachment-model.mjs) | 已审拆分：显式模块白名单与JSON跨域桥接；内存SQL/SDK端口及预声明数据模型 |
| [tests/test-support/wholesale-release-case.ts](../../../tests/test-support/wholesale-release-case.ts) | 已审保留：专属准备和阶段登记；完整独立数据版本；已确认范围原子回收 |
| [tests/test-support/wholesale-release-receipts.ts](../../../tests/test-support/wholesale-release-receipts.ts) | 已审保留：种子与发布归属；分配和真实结汇；逐笔冲销及订单终态 |
| [tests/test-support/wholesale-release-seed.ts](../../../tests/test-support/wholesale-release-seed.ts) | 已审保留：实际专属角色与上海日期；两订单与手工报价准备 |
| [tests/unit/admin-auth-sync-race.mjs](../../../tests/unit/admin-auth-sync-race.mjs) | 已审拆分：显式内存数据库和Auth响应替身；同一真实同步源码的两份独立模块加载；迟到Auth写入按最新版本恢复场景 |
| [tests/unit/admin-auth-sync-recovery.mjs](../../../tests/unit/admin-auth-sync-recovery.mjs) | 已审拆分：显式内存数据库和Auth响应替身；同一真实同步源码的两份独立模块加载；读回中断后列表协调和新进程补偿场景 |

### Supabase

| 文件 | 阅读重点 |
| --- | --- |
| [scripts/benchmark-logistics-writes.mjs](../../../../PT5-dropshipping-supabase/scripts/benchmark-logistics-writes.mjs) | 已审拆分：历史函数边界提取与专属夹具准入；前后写入及真实分页/业务摘要比较；回滚后的记录与函数权限核对 |
| [scripts/check-logistics-functions.mjs](../../../../PT5-dropshipping-supabase/scripts/check-logistics-functions.mjs) | 已审拆分：局部TypeScript/SDK配置生成；有界编译进程和退出状态；本次独占配置回收 |
| [scripts/exchange-rate-current-run.test.mjs](../../../../PT5-dropshipping-supabase/scripts/exchange-rate-current-run.test.mjs) | 已审拆分：验证空计划任务终态；核对人民币固定值的运行和报价凭证 |
| [scripts/exchange-rate-sync-cases.mjs](../../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-cases.mjs) | 已审保留：原场景和稳定业务日期；真实重试终态驱动；报价/运行/回执业务断言 |
| [scripts/exchange-rate-sync-edge.mjs](../../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-edge.mjs) | 已审保留：实际Edge项目与网络；生效配置与启动壳；真实挂载源码逐份比较 |
| [scripts/exchange-rate-sync-environment.mjs](../../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-environment.mjs) | 已审拆分：CLI专属SQL目标与在途请求归属；安全的进程输出；委托实际Edge挂载核验 |
| [scripts/exchange-rate-sync-fixture.mjs](../../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-fixture.mjs) | 已审保留：预声明请求与完整行版本快照；原派发及已确认结果采集；锁内限定回收与独立查零 |
| [scripts/exchange-rate-sync-source.mjs](../../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-source.mjs) | 已审保留：本次UUID合成凭据与来源校验；有限本机HTTP报价协议与回收；测试启动壳的外部fetch边界 |
| [scripts/export-learning-schema.mjs](../../../../PT5-dropshipping-supabase/scripts/export-learning-schema.mjs) | 已审保留：本地迁移集合确认；生成系统目录结构索引 |
| [scripts/learning-lead-fixture-sql.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-lead-fixture-sql.mjs) | 已审拆分：严格参数及固定归属；创建/原子清理事务；独立读回及凭证校验 |
| [scripts/learning-lead-fixture.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-lead-fixture.mjs) | 已审拆分：参数和固定本项目准入；有界SQL执行与唯一写凭证；提交后独立读回与打印 |
| [scripts/learning-rule/account-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/account-history-checkpoints.mjs) | 已审拆分：公告受众与已读唯一性；资料重提与审核终态；账号变更及完整审计目录 |
| [scripts/learning-rule/account-write-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/account-write-history-checkpoints.mjs) | 已审保留：直接列权与行权；整体账号事务；Auth补偿偏差核对 |
| [scripts/learning-rule/api-privilege-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/api-privilege-history-checkpoints.mjs) | 已审拆分：函数授权与默认缺口断言；表和序列授权断言；跨版本旧授权夹具 |
| [scripts/learning-rule/bulk-claim-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/bulk-claim-history-checkpoints.mjs) | 已审拆分：跨版本采购及订单快照夹具；批量拒绝与独立业务凭证 |
| [scripts/learning-rule/business-parameter-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/business-parameter-history-checkpoints.mjs) | 已审拆分：一致基线及配置迁移核对；订单/提成版本固定；发布/预约取消与岗位检查 |
| [scripts/learning-rule/business-parameter-migration-fixture.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/business-parameter-migration-fixture.mjs) | 已审拆分：原迁移脏行再现；真实修复合成夹具；一致基线快照 |
| [scripts/learning-rule/business-vip-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/business-vip-history-checkpoints.mjs) | 已审拆分：旧版 VIP 审批与权限断言；跨版本收费保留夹具 |
| [scripts/learning-rule/claim-group-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/claim-group-history-checkpoints.mjs) | 已审拆分：认领组历史写入；读取优化及权限对照；旧模型退出与保留凭证 |
| [scripts/learning-rule/commission-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/commission-history-checkpoints.mjs) | 已审拆分：验证订单佣金和 VIP 到期时间；跨版本验证系统入账和人工结算 |
| [scripts/learning-rule/commission-policy-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/commission-policy-history-checkpoints.mjs) | 已审拆分：历史配置读写权限断言；成本回填与计算对照 |
| [scripts/learning-rule/company-template-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/company-template-history-checkpoints.mjs) | 已审拆分：旧非空资料替代保护；模板发布及不可变版本；个人文档和保存协议演进 |
| [scripts/learning-rule/customer-maintenance-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/customer-maintenance-history-checkpoints.mjs) | 已审拆分：客户维护事务夹具；规范化与权限检查点 |
| [scripts/learning-rule/document-explorer-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/document-explorer-history-checkpoints.mjs) | 已审拆分：文档协议与真实身份检查；迁移夹具及不变性/失败守卫；原SQL与独占回滚凭证 |
| [scripts/learning-rule/document-library-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/document-library-history-checkpoints.mjs) | 已审拆分：资料库协议与授权检查；非空入目录及列表迁移凭证；原SQL与完整状态回滚 |
| [scripts/learning-rule/environment.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/environment.mjs) | 已审拆分：专属容器识别与生命周期；结构恢复与调度隔离；受限 SQL 执行 |
| [scripts/learning-rule/finance-expense-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/finance-expense-history-checkpoints.mjs) | 已审拆分：财务权限演进断言；公司费用权限与字段约束断言；跨版本财务夹具 |
| [scripts/learning-rule/flexible-access-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/flexible-access-history-checkpoints.mjs) | 已审保留：专属无密码身份夹具；四岗位配置及默认边界；代查权限与失活空集合 |
| [scripts/learning-rule/historical-rate-backfill-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/historical-rate-backfill-checkpoints.mjs) | 已审拆分：服务角色补缺与输入边界；原银行SQL回归；独立读回与回滚 |
| [scripts/learning-rule/index-function-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/index-function-history-checkpoints.mjs) | 已审保留：索引目录事实；函数路径与授权差异；外键前导列逐项核对 |
| [scripts/learning-rule/inventory-items-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/inventory-items-history-checkpoints.mjs) | 已审保留：商品输入与历史签名检查；后台信贷及还款检查；业务记录和审计回读 |
| [scripts/learning-rule/inventory-order-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/inventory-order-history-checkpoints.mjs) | 已审保留：合成角色和拒绝原因表达；历史订单维护检查；独立读回及回滚凭证 |
| [scripts/learning-rule/lead-assignment-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/lead-assignment-history-checkpoints.mjs) | 已审拆分：专属身份及跨版本夹具；领取和客户转换终态检查；原迁移失败保护检查 |
| [scripts/learning-rule/lead-daily-limit-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/lead-daily-limit-history-checkpoints.mjs) | 已审保留：额度入口回归；自然日边界；失败后记录核对 |
| [scripts/learning-rule/lead-import-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/lead-import-history-checkpoints.mjs) | 已审拆分：完整来源及误并夹具；导入/租约独立凭证；画像导入与回滚检查 |
| [scripts/learning-rule/logistics-archive-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/logistics-archive-history-checkpoints.mjs) | 已审拆分：归档与分页演进；来源时间及日期范围；完整读取及索引保留 |
| [scripts/learning-rule/logistics-assignment-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/logistics-assignment-history-checkpoints.mjs) | 已审拆分：店铺归属命令与输入拒绝；区间、处理人与分页独立凭证 |
| [scripts/learning-rule/logistics-lease-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/logistics-lease-history-checkpoints.mjs) | 已审拆分：真实租约及页断点；合成前置与观测协议；原SQL回归及完整回滚 |
| [scripts/learning-rule/logistics-link-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/logistics-link-history-checkpoints.mjs) | 已审拆分：历史关联写入与独立读回；列表预期与输入校验；权限零影响和回滚清理 |
| [scripts/learning-rule/logistics-status-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/logistics-status-history-checkpoints.mjs) | 已审拆分：物流镜像角色断言；内部派发条件与HTTP模拟；实际列表索引核对 |
| [scripts/learning-rule/mail-delivery-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/mail-delivery-history-checkpoints.mjs) | 已审保留：失联发送领取；归档原子性；永久拒绝回执 |
| [scripts/learning-rule/mail-history-fixture.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/mail-history-fixture.mjs) | 已审保留：基础合成邮件；旧身份回填夹具；原始迁移冲突反例 |
| [scripts/learning-rule/mail-intake-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/mail-intake-history-checkpoints.mjs) | 已审保留：规则审计原子性；命中与版本失败；联系及忽略回执 |
| [scripts/learning-rule/mail-page-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/mail-page-history-checkpoints.mjs) | 已审拆分：邮件筛选与历史/当前分页；完整报告统计 |
| [scripts/learning-rule/mail-quarantine-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/mail-quarantine-history-checkpoints.mjs) | 已审保留：身份回填核对；整批隔离与守卫；恢复和通知凭证 |
| [scripts/learning-rule/mail-workspace-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/mail-workspace-history-checkpoints.mjs) | 已审保留：共享邮箱配置；会话版本与统计；任务领取及权限凭证 |
| [scripts/learning-rule/monthly-allocation-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/monthly-allocation-history-checkpoints.mjs) | 已审保留：有效分配及上海月界；缺价与撤销换算；查询优化等价回归 |
| [scripts/learning-rule/navigation-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/navigation-history-checkpoints.mjs) | 已审拆分：平台默认授权探针；本人偏好保存与可见性；拒绝和零影响后的独立核对 |
| [scripts/learning-rule/operation-boundary-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/operation-boundary-history-checkpoints.mjs) | 已审拆分：认领业务异常凭证；孤立附件元数据读取；结汇指定日期派发 |
| [scripts/learning-rule/operation-rate-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/operation-rate-history-checkpoints.mjs) | 已审保留：后台报价历史检查；全局重算及回滚检查；稳定观察与独立完整凭证输出 |
| [scripts/learning-rule/operation-run-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/operation-run-history-checkpoints.mjs) | 已审拆分：直接请求账本检查；后台重试及超时检查；读取与告警检查 |
| [scripts/learning-rule/order-date-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/order-date-history-checkpoints.mjs) | 已审拆分：上海日期、精确与既选回显；客户投影及查询准入；索引目录和限定夹具清理 |
| [scripts/learning-rule/order-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/order-history-checkpoints.mjs) | 已审拆分：准备早期账号和旧订单数据；定义 UUID、编号、写入及角色检查点 |
| [scripts/learning-rule/order-list-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/order-list-history-checkpoints.mjs) | 已审拆分：合成订单与身份夹具；附件限额及批量原子性检查；客户投影与存储目录检查 |
| [scripts/learning-rule/order-maintenance-lifecycle-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/order-maintenance-lifecycle-checkpoints.mjs) | 已审拆分：旧批准与冻结佣金夹具；直接修改及历史留痕；创建请求防重与独立凭证 |
| [scripts/learning-rule/order-money-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/order-money-history-checkpoints.mjs) | 已审拆分：验证当天及最近报价选择；验证服务费回填与重算凭证；验证人民币金额由锁汇计算 |
| [scripts/learning-rule/order-month-privacy-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/order-month-privacy-history-checkpoints.mjs) | 已审保留：月份日期及完整汇总；客户内部投影；受控关联联系人读取 |
| [scripts/learning-rule/order-page-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/order-page-history-checkpoints.mjs) | 已审拆分：历史与当前分页确定性；全量汇总及客户投影；隔离订单与结汇夹具 |
| [scripts/learning-rule/order-scope-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/order-scope-history-checkpoints.mjs) | 已审拆分：验证分类明细与代发佣金边界；验证业务授权和人员选项补丁；核对客户标记的归属与操作人 |
| [scripts/learning-rule/partial-settlement-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/partial-settlement-history-checkpoints.mjs) | 已审拆分：旧结汇回填夹具；部分结汇与权限检查点 |
| [scripts/learning-rule/pending-review-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/pending-review-history-checkpoints.mjs) | 已审拆分：真实待审核夹具；敏感视图权限检查点 |
| [scripts/learning-rule/personal-workspace-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/personal-workspace-history-checkpoints.mjs) | 已审拆分：人员城市与目录检查；个人待办和布局检查 |
| [scripts/learning-rule/policy-visibility-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/policy-visibility-history-checkpoints.mjs) | 已审拆分：八岗位可见集合基线；策略结构与代表性写入；InitPlan计划核对 |
| [scripts/learning-rule/practice-data.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/practice-data.mjs) | 已审拆分：专属线索与练习角色；练习草稿生成；本次草稿内容核对 |
| [scripts/learning-rule/quotation-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/quotation-history-checkpoints.mjs) | 已审拆分：旧报价状态/修订检查；首版幂等及空值检查；本人图片元数据范围 |
| [scripts/learning-rule/referral-board-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/referral-board-history-checkpoints.mjs) | 已审拆分：构造两类旧推荐关系；验证迁移及真实历史 Auth 触发器；验证板选择、重复绑定和后缀缺口 |
| [scripts/learning-rule/reimbursement-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/reimbursement-history-checkpoints.mjs) | 已审拆分：专属运营夹具；周期与状态检查点；权限及影响数反例 |
| [scripts/learning-rule/reimbursement-sharing-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/reimbursement-sharing-history-checkpoints.mjs) | 已审拆分：无密码运营夹具；共享汇总与本人状态检查；跨版本权限恢复检查 |
| [scripts/learning-rule/release-allocation-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/release-allocation-history-checkpoints.mjs) | 已审拆分：旧关系转换夹具与独立快照；分配改额、守卫及结汇编号核对；清空/缺汇率/零影响和限定清理 |
| [scripts/learning-rule/release-publication-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/release-publication-history-checkpoints.mjs) | 已审拆分：发布人/请求号/内容一致测试；候选及发布拒绝；权威行与回滚凭证 |
| [scripts/learning-rule/request-quota-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/request-quota-history-checkpoints.mjs) | 已审拆分：额度夹具及旧种类退出；租约生命周期和限流；实时身份与归属边界 |
| [scripts/learning-rule/retained-commission-settlement.sql](../../../../PT5-dropshipping-supabase/scripts/learning-rule/retained-commission-settlement.sql) | 已审拆分：建立订单与任务专属数据；核对权限和两笔终态；回滚并独立读回 |
| [scripts/learning-rule/review-submission-boundaries.sql](../../../../PT5-dropshipping-supabase/scripts/learning-rule/review-submission-boundaries.sql) | 已审拆分：准备事务内账号和角色；检查越权请求与正常登记；核对管理员终态并回滚 |
| [scripts/learning-rule/sales-staff-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/sales-staff-history-checkpoints.mjs) | 已审拆分：私人备注的所有者检查；推广员范围与角色转换检查 |
| [scripts/learning-rule/service-fee-tier-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/service-fee-tier-history-checkpoints.mjs) | 已审拆分：验证目录及旧自定义档；核对自动匹配及总单与明细关系；测试预览门槛、编辑排除及改名 |
| [scripts/learning-rule/service-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/service-history-checkpoints.mjs) | 已审拆分：验证上海当天报价和订单锁汇；验证工作台反馈提交及处理；验证图片回填、入队和人工终态 |
| [scripts/learning-rule/settlement-rate-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/settlement-rate-history-checkpoints.mjs) | 已审保留：银行与人工报价边界；结汇引用及金额快照；旧参考退出与原SQL回归 |
| [scripts/learning-rule/settlement-release-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/settlement-release-history-checkpoints.mjs) | 已审拆分：发布与认领夹具；双向凭证和失败检查点 |
| [scripts/learning-rule/staff-access-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/staff-access-history-checkpoints.mjs) | 已审保留：财务真实协作检查；索引列和有效性核对；汇率岗位读写范围检查 |
| [scripts/learning-rule/task-acceptance-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/task-acceptance-history-checkpoints.mjs) | 已审拆分：保存旧领取与关联快照；复现两人第一轮的唯一索引冲突；核对恢复事务和实际迁移结果 |
| [scripts/learning-rule/task-dispatch-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/task-dispatch-history-checkpoints.mjs) | 已审拆分：验证定向派发与类型状态；验证邀请码校验与角色联动；验证多人领取和历史汇总权限 |
| [scripts/learning-rule/task-evidence-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/task-evidence-history-checkpoints.mjs) | 已审拆分：验证旧任务默认和两类提交；核对审核佣金、草稿状态与岗位边界 |
| [scripts/learning-rule/task-review-decision-round.sql](../../../../PT5-dropshipping-supabase/scripts/learning-rule/task-review-decision-round.sql) | 已审拆分：创建并回滚专属夹具；测试错轮次与权限；验证审核及佣金终态 |
| [scripts/learning-rule/task-review-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/task-review-history-checkpoints.mjs) | 已审拆分：验证草稿、附件及审核轮次；验证完成任务触发器及统一权限；为后续迁移保留奖励夹具 |
| [scripts/learning-rule/team-task-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/team-task-history-checkpoints.mjs) | 已审拆分：建立合成团队及关联数据；验证团队、任务和成本的历史检查点 |
| [scripts/learning-rule/tourism-shutdown-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/tourism-shutdown-history-checkpoints.mjs) | 已审拆分：切换前完整行指纹夹具；停用后普通角色及ACL核对；导航过滤及回滚 |
| [scripts/learning-rule/vip-scope-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/vip-scope-history-checkpoints.mjs) | 已审拆分：验证旧会员与服务价格转换；验证充值审核、续费和拒绝；只读核对后台配置权限 |
| [scripts/learning-rule/wholesale-access-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/wholesale-access-history-checkpoints.mjs) | 已审拆分：默认入口和销售范围检查；注册账号关联与开通检查 |
| [scripts/learning-rule/wholesale-classification-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/wholesale-classification-history-checkpoints.mjs) | 已审拆分：历史归类夹具与权限断言；身份声明修复前对照 |
| [scripts/learning-rule/wholesale-collaboration-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/wholesale-collaboration-history-checkpoints.mjs) | 已审拆分：候选身份夹具；读取与处理阶段对照；关联创建凭证和审计保护 |
| [scripts/learning-rule/wholesale-commission-setting-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/wholesale-commission-setting-history-checkpoints.mjs) | 已审拆分：旧比例与采购配置退休历史；客户分类迁移原子性与审计；费用/固定版本运行及权限凭证 |
| [scripts/learning-rule/wholesale-edit-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/wholesale-edit-history-checkpoints.mjs) | 已审拆分：订单编辑与审核历史断言 |
| [scripts/learning-rule/wholesale-order-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/wholesale-order-history-checkpoints.mjs) | 已审拆分：跨版本批发订单夹具；金额、认领和创建检查；结汇转换与重复提交检查 |
| [scripts/learning-rule/wholesale-referral-rule-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/wholesale-referral-rule-history-checkpoints.mjs) | 已审拆分：推荐规则配置与更新断言 |
| [scripts/learning-rule/wholesale-role-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/wholesale-role-history-checkpoints.mjs) | 已审拆分：枚举独立提交检查；固定岗位范围与管理员保存检查 |
| [scripts/learning-rule/wholesale-vip-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/wholesale-vip-history-checkpoints.mjs) | 已审拆分：直接开通续期及调整断言；年费约束和收费一致性断言；迁移前异常收费夹具 |
| [scripts/learning-rule/wholesale-write-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/wholesale-write-history-checkpoints.mjs) | 已审拆分：双方客户和订单夹具；策略、触发器与包装入口对照；账号候选和关联结果检查 |
| [scripts/learning-rule/worker-attempt-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/worker-attempt-history-checkpoints.mjs) | 已审拆分：图片领取状态；后台执行代际保护；物流失败预算 |
| [scripts/learning-rule/worker-competition-history.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/worker-competition-history.mjs) | 已审拆分：专属psql连接生命周期；真实锁等待编排；独立凭证及限定清理 |
| [scripts/learning-rule/workspace-access-history-checkpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/learning-rule/workspace-access-history-checkpoints.mjs) | 已审拆分：旧批发清理范围快照；工作台授权和读取边界检查 |
| [scripts/local-logistics-sql.mjs](../../../../PT5-dropshipping-supabase/scripts/local-logistics-sql.mjs) | 已审拆分：专属SQL容器声明和真实元数据准入；实际目录/调度只读预检；有界SQL执行与精确预期错误判定 |
| [scripts/local-logistics-sql.test.mjs](../../../../PT5-dropshipping-supabase/scripts/local-logistics-sql.test.mjs) | 已审拆分：真实SQL执行器的明确合成进程边界与退出凭证 |
| [scripts/logistics-docker-page-sql.mjs](../../../../PT5-dropshipping-supabase/scripts/logistics-docker-page-sql.mjs) | 已审拆分：确定性业务夹具与八身份前提；实际分页/权限及回退对照；完整业务行与元数据指纹 |
| [scripts/logistics-page-independent-sql.mjs](../../../../PT5-dropshipping-supabase/scripts/logistics-page-independent-sql.mjs) | 已审拆分：从原始档案与半开归属区间生成独立预期；验证业务员真实数据库角色目录与三组分页；执行原回滚并核对函数属性及200完整输出 |
| [scripts/logistics-page-performance-model.mjs](../../../../PT5-dropshipping-supabase/scripts/logistics-page-performance-model.mjs) | 已审拆分：定义历史模型固定身份与25筛选输入；组织完整语义分页及权限错误边界；生成逐身份交替计时样本 |
| [scripts/logistics-page-performance-plan.mjs](../../../../PT5-dropshipping-supabase/scripts/logistics-page-performance-plan.mjs) | 已审拆分：从批准迁移完整展开实际日期查询；执行真实计划并核对非空扫描预算 |
| [scripts/logistics-performance-target.mjs](../../../../PT5-dropshipping-supabase/scripts/logistics-performance-target.mjs) | 已审拆分：创建和按随机归属回收空PG17实例；核验显式声明及真实Docker/数据库准入；执行有界SQL并独立证明恢复与保留证据 |
| [scripts/logistics-worker-model.mjs](../../../../PT5-dropshipping-supabase/scripts/logistics-worker-model.mjs) | 已审拆分：历史模型与函数准备；档案和观测独立预期；无关夹具完整指纹 |
| [scripts/logistics-worker-scenario.mjs](../../../../PT5-dropshipping-supabase/scripts/logistics-worker-scenario.mjs) | 已审拆分：受限RPC适配和丢回执重放；原三页限流续跑场景；独立内容/检查点/分页凭证 |
| [scripts/logistics-worker-session.mjs](../../../../PT5-dropshipping-supabase/scripts/logistics-worker-session.mjs) | 已审拆分：固定专属目标与单连接传输；串行查询及完整行凭证；有界收尾与独立恢复 |
| [scripts/logistics-worker-source.mjs](../../../../PT5-dropshipping-supabase/scripts/logistics-worker-source.mjs) | 已审拆分：确定性来源与一次限流；请求/并发与错误观测；本机HTTP连接收尾 |
| [scripts/measure-logistics-undated-index.mjs](../../../../PT5-dropshipping-supabase/scripts/measure-logistics-undated-index.mjs) | 已审拆分：构造四组索引/日期写入与真实档案观测核对；检查二十个计时及索引指标并保存本次汇总 |
| [scripts/migrate-local-docker.mjs](../../../../PT5-dropshipping-supabase/scripts/migrate-local-docker.mjs) | 已审拆分：本地目标及空闲核验；CLI数据库通道与生命周期 |
| [scripts/nowapi-quotes.test.mjs](../../../../PT5-dropshipping-supabase/scripts/nowapi-quotes.test.mjs) | 已审保留：合成现价解析；日末历史完整性；时间单位及冲突拒绝 |
| [scripts/prepare-learning-rule-sandbox.mjs](../../../../PT5-dropshipping-supabase/scripts/prepare-learning-rule-sandbox.mjs) | 已审保留：隔离练习准备和清理的命令调度 |
| [scripts/sales-lead-sync-fixture.mjs](../../../../PT5-dropshipping-supabase/scripts/sales-lead-sync-fixture.mjs) | 已审拆分：固定日期的随机归属来源文档；归属/外来记录完整行与版本快照SQL；原子准备、尝试派发、捕获与精确回收SQL |
| [scripts/test-document-windows-concurrency.mjs](../../../../PT5-dropshipping-supabase/scripts/test-document-windows-concurrency.mjs) | 已审拆分：专属数据库的多连接协调及真实阻塞观察；两组原目录命名/同号防重场景和权威凭证核对；本次随机夹具的准备、连接收尾及精确回收 |
| [scripts/test-exchange-rate-sync-local.mjs](../../../../PT5-dropshipping-supabase/scripts/test-exchange-rate-sync-local.mjs) | 已审拆分：专属准入和本机CLI状态/种子读取；原Auth/HTTP与独立会话凭证；资源调度、限定收尾和结果报告 |
| [scripts/test-function-default-privileges.mjs](../../../../PT5-dropshipping-supabase/scripts/test-function-default-privileges.mjs) | 已审拆分：编排隔离默认授权探针；应用本地候选并核对已有 ACL；调度与清理边界验证 |
| [scripts/test-learning-admin-cli.mjs](../../../../PT5-dropshipping-supabase/scripts/test-learning-admin-cli.mjs) | 已审拆分：临时 Data API 边界；真实 CLI 调用与故障注入；隔离数据库夹具和收尾 |
| [scripts/test-learning-history-prefix.mjs](../../../../PT5-dropshipping-supabase/scripts/test-learning-history-prefix.mjs) | 已审拆分：历史版本与领域调度；原文执行及分阶段证据；专属实例及限定回收 |
| [scripts/test-learning-page-limit.mjs](../../../../PT5-dropshipping-supabase/scripts/test-learning-page-limit.mjs) | 已审拆分：专属练习清单与起点检查；执行学员草稿和断言；独立回滚读回与证据 |
| [scripts/test-order-commission-read-boundary.mjs](../../../../PT5-dropshipping-supabase/scripts/test-order-commission-read-boundary.mjs) | 已审拆分：佣金越权复现和修复验证；授权入口与零写入凭证 |
| [scripts/test-order-number-boundaries.mjs](../../../../PT5-dropshipping-supabase/scripts/test-order-number-boundaries.mjs) | 已审拆分：校验业务调用者及所有者权限；验证普通直接调用被拒绝和序号保留；清理隔离环境 |
| [scripts/test-retail-vip-sync-boundary.mjs](../../../../PT5-dropshipping-supabase/scripts/test-retail-vip-sync-boundary.mjs) | 已审拆分：复现第三方会员被重算；核对权限拒绝及管理员调整；清理专属副本 |
| [scripts/test-retained-commission-settlement.mjs](../../../../PT5-dropshipping-supabase/scripts/test-retained-commission-settlement.mjs) | 已审拆分：编排隔离数据库夹具和清理 |
| [scripts/test-review-submission-boundaries.mjs](../../../../PT5-dropshipping-supabase/scripts/test-review-submission-boundaries.mjs) | 已审拆分：编排隔离权限测试与清理 |
| [scripts/test-sales-lead-sync-local.mjs](../../../../PT5-dropshipping-supabase/scripts/test-sales-lead-sync-local.mjs) | 已审拆分：专属DB/API/Edge准入与受控SQL执行；本地来源HTTP生命周期；同一任务重试、独立凭证及失败收尾 |
| [scripts/test-signup-referral-write-boundary.mjs](../../../../PT5-dropshipping-supabase/scripts/test-signup-referral-write-boundary.mjs) | 已审拆分：复现第三方推荐和授权写入；验证拒绝及合法 Auth 注册；清理专属副本 |
| [scripts/test-task-review-decision-round.mjs](../../../../PT5-dropshipping-supabase/scripts/test-task-review-decision-round.mjs) | 已审拆分：启动隔离数据库；执行审核专项 SQL；清理临时容器与结构快照 |
| [scripts/verify-logistics-migrations.mjs](../../../../PT5-dropshipping-supabase/scripts/verify-logistics-migrations.mjs) | 已审拆分：原历史函数/测试事务边界组装；专属副本内四迁移及三独立保存点调度；演练前后数据/结构/执行权恢复核对 |
| [scripts/verify-logistics-page-docker.mjs](../../../../PT5-dropshipping-supabase/scripts/verify-logistics-page-docker.mjs) | 已审拆分：专属执行器及有界调度；准确凭证与恢复判断；排他证据存储 |
| [scripts/verify-logistics-page-independent-rollback.mjs](../../../../PT5-dropshipping-supabase/scripts/verify-logistics-page-independent-rollback.mjs) | 已审拆分：调度当前独立模型和有界执行；核对六份归属/四份回滚及排他汇总 |
| [scripts/verify-logistics-page-performance.mjs](../../../../PT5-dropshipping-supabase/scripts/verify-logistics-page-performance.mjs) | 已审拆分：调度正常及两个原计划负例模式；核对完整身份/计时/扫描及真实证据汇总 |
| [scripts/verify-logistics-release-timeouts.mjs](../../../../PT5-dropshipping-supabase/scripts/verify-logistics-release-timeouts.mjs) | 已审保留：事务外SET LOCAL预期拒绝；事务内设置生效及回滚后会话恢复 |
| [scripts/verify-logistics-rollback.mjs](../../../../PT5-dropshipping-supabase/scripts/verify-logistics-rollback.mjs) | 已审拆分：隔离实例与专属夹具编排；执行原回滚及可控失败核对；保存独立凭证并回收实例 |
| [scripts/verify-logistics-worker-pg17.mjs](../../../../PT5-dropshipping-supabase/scripts/verify-logistics-worker-pg17.mjs) | 已审拆分：场景调度；分别收尾与失败归并；唯一证据与退出状态 |
| [scripts/verify-operation-regressions.mjs](../../../../PT5-dropshipping-supabase/scripts/verify-operation-regressions.mjs) | 已审拆分：三套原/拆分SQL的事务边界检查；显式专属副本内回归调度；九表行版本及函数执行权恢复核对 |
| [supabase/tests/admin_auth_metadata_reconciliation.sql](../../../../PT5-dropshipping-supabase/supabase/tests/admin_auth_metadata_reconciliation.sql) | 已审拆分：专属Auth字段偏差与待同步凭证恢复；service_role执行与普通/匿名实际拒绝 |
| [supabase/tests/admin_person_account_bundle.sql](../../../../PT5-dropshipping-supabase/supabase/tests/admin_person_account_bundle.sql) | 已审拆分：整体账号变更与旧快照冲突；资料角色业务范围和本次审计/补偿目标独立读回；停用管理员旧声明直接写和整笔变更拒绝 |
| [supabase/tests/api_request_quotas.sql](../../../../PT5-dropshipping-supabase/supabase/tests/api_request_quotas.sql) | 已审拆分：并发次数、所有权及停用类别合同；临时身份/断言辅助；事件记录和实际释放状态独立核对 |
| [supabase/tests/boc_exchange_rate_historical_backfill.sql](../../../../PT5-dropshipping-supabase/supabase/tests/boc_exchange_rate_historical_backfill.sql) | 已审保留：银行报价单位、日期及重试断言；授权目录、冲突和人民币固定值 |
| [supabase/tests/boc_exchange_rate_recalculation.sql](../../../../PT5-dropshipping-supabase/supabase/tests/boc_exchange_rate_recalculation.sql) | 已审拆分：银行牌价单位、发布时间、日期引用及舍入；批发预览/执行、分配、版本冲突与失败原子性；普通订单已支付佣金及美元累计窗口 |
| [supabase/tests/business_parameter_versions.sql](../../../../PT5-dropshipping-supabase/supabase/tests/business_parameter_versions.sql) | 已审拆分：验证立即发布、完整重试及岗位/停用/匿名拒绝；验证上海月界预约、取消回执及真实修订和取消人；验证订单锁定、恢复基准的新版本及同月逐单佣金汇总 |
| [supabase/tests/company_template_documents.sql](../../../../PT5-dropshipping-supabase/supabase/tests/company_template_documents.sql) | 已审保留：固定目录和角色夹具断言；带修订写入/位置/内容凭证；协作隔离和重复/失败断言 |
| [supabase/tests/company_template_usage_capability.sql](../../../../PT5-dropshipping-supabase/supabase/tests/company_template_usage_capability.sql) | 已审保留：原始HTML与生成文档凭证；模板新旧版本和个人数据隔离 |
| [supabase/tests/company_templates.sql](../../../../PT5-dropshipping-supabase/supabase/tests/company_templates.sql) | 已审拆分：批准内置内容/指纹和三岗位夹具准入；发布/版本/状态各自回执、真实行与不可变性；员工/客户读取范围及RLS/表权限 |
| [supabase/tests/customer-inventory/client-applications-and-review.sql](../../../../PT5-dropshipping-supabase/supabase/tests/customer-inventory/client-applications-and-review.sql) | 已审保留：客户可见范围与信贷申请；管理员完整批次审核；私有附件登记限制 |
| [supabase/tests/customer-inventory/creation-and-managed-credit.sql](../../../../PT5-dropshipping-supabase/supabase/tests/customer-inventory/creation-and-managed-credit.sql) | 已审保留：申请与后台混合来源信贷；全额支付及商品维护；商品/未注册客户/财务输入约束 |
| [supabase/tests/customer-inventory/currency-repayment-and-reuse.sql](../../../../PT5-dropshipping-supabase/supabase/tests/customer-inventory/currency-repayment-and-reuse.sql) | 已审保留：人民币审核与汇率快照；延期及逾期还款；固定/单笔档位复用 |
| [supabase/tests/customer-inventory/storage-and-staff-credit.sql](../../../../PT5-dropshipping-supabase/supabase/tests/customer-inventory/storage-and-staff-credit.sql) | 已审保留：私有Storage表策略与经理读取边界；财务固定信贷直接管理；管理员三档直接管理与还清 |
| [supabase/tests/customer_inventory_orders_and_credit.sql](../../../../PT5-dropshipping-supabase/supabase/tests/customer_inventory_orders_and_credit.sql) | 已审拆分：专属样本与会话前置核对；报价及SQL声明/断言帮助函数；四组顺序编排与最终回滚 |
| [supabase/tests/dashboard_numbered_page_permissions.sql](../../../../PT5-dropshipping-supabase/supabase/tests/dashboard_numbered_page_permissions.sql) | 已审保留：完整管理员目录及客户端邮件分页ACL；普通客户直接调用管理员日志拒绝 |
| [supabase/tests/database_governance.sql](../../../../PT5-dropshipping-supabase/supabase/tests/database_governance.sql) | 已审拆分：public/private外键的可用前导索引核对；现用函数存在/固定路径与已删除签名缺席；public同角色/动作宽松策略合并核对 |
| [supabase/tests/document_cleanup_retry.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_cleanup_retry.sql) | 已审保留：专属夹具准备与事务回滚；断言重试、凭证、零影响和权限边界 |
| [supabase/tests/document_explorer.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_explorer.sql) | 已审保留：目录移动与清单；批次保护与中断；撤权后的读取和后台续办拒绝 |
| [supabase/tests/document_library_grants.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_library_grants.sql) | 已审保留：资料表角色授权核对；直接写入及清空拒绝 |
| [supabase/tests/document_personal_copy.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_personal_copy.sql) | 已审保留：统一目录及直接写入保护；复制与旧版本拒绝；客户读取隔离 |
| [supabase/tests/document_unified_folder.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_unified_folder.sql) | 已审保留：验证每个归档唯一默认目录；核对旧分区限制及员工与客户资料隔离 |
| [supabase/tests/document_windows.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_windows.sql) | 已审保留：公共单例及导航读取；默认名称/版本/去重；公共资料权限与回滚 |
| [supabase/tests/exchange_rate_visibility.sql](../../../../PT5-dropshipping-supabase/supabase/tests/exchange_rate_visibility.sql) | 已审拆分：活跃岗位、停用客户及匿名读取；普通岗位写入拒绝与配置隔离；管理员增改删和最终记录核对 |
| [supabase/tests/finance_wholesale_permissions.sql](../../../../PT5-dropshipping-supabase/supabase/tests/finance_wholesale_permissions.sql) | 已审保留：验证财务协作和管理员边界；核对财务订单写入及审计记录 |
| [supabase/tests/learning_page_limit.sql](../../../../PT5-dropshipping-supabase/supabase/tests/learning_page_limit.sql) | 已审拆分：分页变化与行数断言；普通客户拒绝；事务结果与回滚 |
| [supabase/tests/legacy_tourism_business_disabled.sql](../../../../PT5-dropshipping-supabase/supabase/tests/legacy_tourism_business_disabled.sql) | 已审保留：验证停用业务的入口与有效权限；校验旅游表和对象策略；核对历史维护函数的执行授权 |
| [supabase/tests/logistics_continuation.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_continuation.sql) | 已审拆分：正常续跑预算；永久错误与耗尽；未启动及运行超时 |
| [supabase/tests/logistics_page_performance_fixture.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_page_performance_fixture.sql) | 已审保留：建立确定性身份和人员客户目录；建立真实物流结构索引及行策略模型；准备固定日期边界和27541条容量样本 |
| [supabase/tests/logistics_page_performance_observations.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_page_performance_observations.sql) | 已审拆分：设置固定来源观测与缺观测回退锚点；确认两个锚点实际命中并更新模型统计信息 |
| [supabase/tests/logistics_retry.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_retry.test.mjs) | 已审保留：限流等待与临时/永久错误分类；来源游标与页提交合同；Worker片段预算及最终凭证 |
| [supabase/tests/logistics_rollback_after.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_rollback_after.sql) | 已审保留：核对恢复后的签名与权限；对比完整范围汇总及独立新鲜度；以真实服务角色完成旧调用及账本 |
| [supabase/tests/logistics_rollback_before.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_rollback_before.sql) | 已审保留：构造两份专属归档及后续观测；核对当前JSON写入合同与授权；在真实管理员权限下保存非空分页基线 |
| [supabase/tests/logistics_write_resume.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_write_resume.sql) | 已审拆分：写入及物理更新验证；断点恢复与终态；重试及失败预算 |
| [supabase/tests/mail-workspace/delivery-receipts.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail-workspace/delivery-receipts.sql) | 已审拆分：验证已联系收件人的真实消息/会话关联；验证陌生来信回执/审计及重复不重写；验证精确事件领取/次数/锁时间和未来事件保护 |
| [supabase/tests/mail-workspace/rules.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail-workspace/rules.sql) | 已审拆分：验证规则创建/更新/删除的真实字段和版本；验证原子审计及过期修订不改写 |
| [supabase/tests/mail-workspace/threads.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail-workspace/threads.sql) | 已审拆分：验证转交的真实负责人/版本及历史；验证隔离恢复的元数据/路由和审计；验证过期版本及整批失败保持完整状态 |
| [supabase/tests/mail_inbound_atomic_recovery.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail_inbound_atomic_recovery.sql) | 已审保留：入站事务原子失败和重试；永久拒绝凭证去重 |
| [supabase/tests/mail_inbound_event_settlement.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail_inbound_event_settlement.sql) | 已审拆分：准备和限定清理合成事件；验证领取竞争、事务回滚和执行权限 |
| [supabase/tests/mail_thread_pagination_and_report_metrics.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail_thread_pagination_and_report_metrics.sql) | 已审拆分：未读筛选与分页 SQL 回归；完整报表统计校验 |
| [supabase/tests/mail_workspace.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail_workspace.sql) | 已审拆分：准备空基线/无密码身份和邮件上下文；逐项验证后台与浏览器数据库权限；调度三段相对包含及统一回滚/TAP终态 |
| [supabase/tests/monthly_settlement_allocated_usd.sql](../../../../PT5-dropshipping-supabase/supabase/tests/monthly_settlement_allocated_usd.sql) | 已审拆分：合成报价、真实建单及分配夹具；上海月界/缺报价/冲销重配的完整汇总合同；管理员财务业务员一致及客户拒绝 |
| [supabase/tests/operator_reimbursement_sharing.sql](../../../../PT5-dropshipping-supabase/supabase/tests/operator_reimbursement_sharing.sql) | 已审拆分：核对九身份并准备专属报销夹具；验证完整分页与本人周期状态及重复确认凭证；验证跨岗位、停用、匿名和私有执行权拒绝 |
| [supabase/tests/order_date_pages.sql](../../../../PT5-dropshipping-supabase/supabase/tests/order_date_pages.sql) | 已审拆分：独立日期边界订单夹具；默认最近30日与精确跨日期检索；非法或缺失筛选拒绝 |
| [supabase/tests/pending_task_reviews_security.sql](../../../../PT5-dropshipping-supabase/supabase/tests/pending_task_reviews_security.sql) | 已审拆分：七岗位及完整待审历史的只读夹具准入；停用旅游下原角色视图和客户底表的读取断言；维护读取及原完整待审关联的保留核对 |
| [supabase/tests/sales_lead_admin_claim.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_admin_claim.sql) | 已审拆分：空白线索及八身份/临时权限夹具；认领联系归还的真实周期与岗位拒绝；停用与固定30天期限边界 |
| [supabase/tests/sales_lead_conversion.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_conversion.sql) | 已审保留：准备隔离线索和认领周期；验证转客户和档案关联；核对拒绝、回收及回滚 |
| [supabase/tests/sales_lead_conversion_concurrency.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_conversion_concurrency.mjs) | 已审拆分：专属SQL连接及实际阻塞观测；随机夹具归属与精确清理；四种转换/回收业务终态断言 |
| [supabase/tests/sales_lead_conversion_migration_guard.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_conversion_migration_guard.mjs) | 已审拆分：隔离实例和合成身份核验；原迁移保护反例与回滚；原认领期限重算回归 |
| [supabase/tests/sales_lead_customer_profile.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_customer_profile.sql) | 已审拆分：导入画像及跨日保留业务状态；转换回执/线索/客户一致凭证；身份冲突隔离与末行失败完整回滚 |
| [supabase/tests/sales_lead_daily_limit.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_daily_limit.sql) | 已审拆分：多入口共用额度；上海自然日及夏令时边界 |
| [supabase/tests/sales_lead_directory_identity.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_directory_identity.sql) | 已审拆分：旧来源误并的合成夹具；两次原迁移及来源/身份键完整关系；六网址精确规范化与幂等终态 |
| [supabase/tests/sales_lead_hall.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_hall.sql) | 已审拆分：来源导入与租约；认领周期及期限；岗位访问断言 |
| [supabase/tests/sales_lead_sync_source.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_sync_source.test.mjs) | 已审保留：来源及批次凭证测试 |
| [supabase/tests/settlement-release/allocation.sql](../../../../PT5-dropshipping-supabase/supabase/tests/settlement-release/allocation.sql) | 已审拆分：验证多订单精确分配与订单收款状态；验证调整/冲销的金额/修订/操作人和历史；验证改选正式客户及旧修订拒绝 |
| [supabase/tests/settlement-release/guards.sql](../../../../PT5-dropshipping-supabase/supabase/tests/settlement-release/guards.sql) | 已审拆分：验证金额/币种/客户失败及完整不变状态；验证财务真实分配正例；验证正金额已发提成原行不重写与禁止改金额 |
| [supabase/tests/settlement-release/publication.sql](../../../../PT5-dropshipping-supabase/supabase/tests/settlement-release/publication.sql) | 已审拆分：验证名称/别名解析与歧义澄清；验证真实发布、防重复及取消凭证；验证业务员拒绝后同一财务可见范围保持 |
| [supabase/tests/signup_business_wizard.sql](../../../../PT5-dropshipping-supabase/supabase/tests/signup_business_wizard.sql) | 已审保留：核对匿名邀请码的业务约束；验证注册触发器产生或回滚客户和推荐；验证管理员开通和重复提交 |
| [supabase/tests/template_document_drafts.sql](../../../../PT5-dropshipping-supabase/supabase/tests/template_document_drafts.sql) | 已审保留：独立草稿的版本和转正；所有者及当前目录授权；原编号重送和事务回滚 |
| [supabase/tests/template_document_folder_boundaries.sql](../../../../PT5-dropshipping-supabase/supabase/tests/template_document_folder_boundaries.sql) | 已审保留：目录生命周期与非空保护断言；业务撤回和旧凭证实时授权断言 |
| [supabase/tests/user_media_image_review_claim.sql](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_image_review_claim.sql) | 已审拆分：随机单图登记及过期夹具准备；首次、拒绝重复和超时恢复的回执/数据库行核对；后台实际执行及浏览器角色拒绝边界 |
| [supabase/tests/user_media_image_review_provider.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_image_review_provider.test.mjs) | 已审保留：合成供应商回执解析断言 |
| [supabase/tests/user_media_image_review_retry.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_image_review_retry.test.mjs) | 已审保留：重试批次计数与结果断言 |
| [supabase/tests/user_media_storage_receipts.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_storage_receipts.test.mjs) | 已审拆分：目录身份与分页；删除前后错误传播；真实清理引擎回归 |
| [supabase/tests/user_media_upload_boundaries.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_upload_boundaries.test.mjs) | 已审保留：存储与审核边界故障回归 |
| [supabase/tests/user_media_upload_policy.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/user_media_upload_policy.test.mjs) | 已审保留：上传输入与对象路径规则断言 |
| [supabase/tests/verified_attachment_cleanup.sql](../../../../PT5-dropshipping-supabase/supabase/tests/verified_attachment_cleanup.sql) | 已审拆分：非空岗位/订单/私有bucket及孤立路径准入；本次精确对象登记准备与两身份RLS读取；维护身份读回原对象及事务回滚 |
| [supabase/tests/verified_operation_runs.test.sql](../../../../PT5-dropshipping-supabase/supabase/tests/verified_operation_runs.test.sql) | 已审拆分：幂等创建和尝试恢复；重试预算与提醒恢复；管理员健康读取和普通岗位拒绝 |
| [supabase/tests/verified_settlement_exchange_rate_repair.sql](../../../../PT5-dropshipping-supabase/supabase/tests/verified_settlement_exchange_rate_repair.sql) | 已审拆分：待分配收款的精确日期任务参数；合成日末报价及缺口恢复；独立事务与错误停止 |
| [supabase/tests/wholesale_client_access_and_order_lists.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_client_access_and_order_lists.sql) | 已审保留：验证客户订单摘要和底表隔离；验证附件登记、类型及归属权限 |
| [supabase/tests/wholesale_customer_commission_and_fees.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_customer_commission_and_fees.sql) | 已审保留：固定客户与可回滚断言夹具；费用/分类及冻结金额断言；发布修订和新旧订单绑定断言 |
| [supabase/tests/wholesale_financial_revision_readback.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_financial_revision_readback.sql) | 已审拆分：最新审计终态与完整覆盖；金额规则及修改前后凭证只读核对；明确诊断状态及保留差异输出 |
| [supabase/tests/wholesale_logistics_archive.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_logistics_archive.sql) | 已审拆分：归档写入及同步租约的连续流程；分页金额和历史店铺归属；真实岗位可见与管理边界 |
| [supabase/tests/wholesale_order_client_contacts.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_client_contacts.sql) | 已审拆分：非空客户/订单/权限夹具核对；客户最小披露及员工目录隔离；停用、恢复、撤权和匿名边界 |
| [supabase/tests/wholesale_order_creation_idempotency.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_creation_idempotency.sql) | 已审拆分：真实业务员创建与归一化重试；订单/请求/内容/版本最终凭证；冲突、缺编号与函数执行权合同 |
| [supabase/tests/wholesale_order_direct_edit_contract.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_direct_edit_contract.sql) | 已审拆分：调用者权限的临时断言助手；已移除表/函数/日志关联列的结构合同 |
| [supabase/tests/wholesale_order_direct_edits.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_direct_edits.sql) | 已审拆分：有权限岗位改单及本次修改日志；待结算提成计算与已结算提成冻结；运营/客户拒绝后的独立状态核对 |
| [supabase/tests/wholesale_order_month_filter.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_month_filter.sql) | 已审拆分：计入月份与下单日期组合；精确检索与非法月份；客户范围及内部字段裁剪 |
| [supabase/tests/wholesale_order_page.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_page.sql) | 已审拆分：管理员完整总数和两页唯一记录；真实订单号精确命中；客户关联集合的非空分页隔离 |
| [supabase/tests/wholesale_order_settlement_idempotency.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_settlement_idempotency.sql) | 已审拆分：重试、冲突和终态验证；授权与无汇率负例 |
| [supabase/tests/wholesale_salesman_collaboration.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_salesman_collaboration.sql) | 已审保留：验证业务员跨档案协作；核对归属修改、清单登记和变更日志；验证佣金和非成员的可见范围 |
| [supabase/tests/wholesale_settlement_releases.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_settlement_releases.sql) | 已审拆分：核对专属身份/订单并提供财务凭证断言；调度三个职责段共享事务与状态快照；验证客户/匿名权限及最终不变状态 |
| [supabase/tests/workspace_navigation_preferences.sql](../../../../PT5-dropshipping-supabase/supabase/tests/workspace_navigation_preferences.sql) | 已审拆分：真实活跃/停用客户与业务状态准入及原偏好夹具；保存返回值、本人真实行和失败保留核对；跨账号RLS、停用/匿名拒绝及事务恢复 |
