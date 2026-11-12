# 汇率本地来源与启动边界

本文保留2026-11-10来源专项的历史范围；后续原CLI的实际本地Auth/网关/Edge/SQL及完整重试/清理见[2026-11-11原CLI验收](verification-2026-11-11-rate-cli.md)。

本批只完成原汇率CLI需要的本地供应商边界，原CLI整份职责审查仍为pending。`scripts/test-exchange-rate-sync-local.mjs`与批前备份字节完全一致，没有运行真实报价或原Auth套件。截图minimatch告警已纳入[依赖整改](verification-2026-11-06-admin-cli-and-security-tests.md#2026-11-10minimatch告警核对与防回退)，本次补充复查9项和双audit均通过。

## 实际执行范围

后端新增`scripts/exchange-rate-sync-source.mjs`，203行，三个职责：本次UUID假凭据、本机HTTP报价协议和临时函数启动壳。服务绑定127.0.0.1，默认43194，测试使用系统分配的空闲端口；端口被占用直接失败，不关闭其他监听。只接受BOC/JSON/三位大写币种，历史日期必须真实且早于当天上海日期；重复和额外字段、错误凭据、16KiB以上正文拒绝。只记录app、币种、日期和固定错误，不记录请求正文、密钥或原始异常。USD返回两条历史样本并由原解析器选择23:59:59的669.93；当前样本同价，ZZZ明确查询失败。

`localRateEntrypoint`生成测试专用Deno启动文件，末尾仍导入原`./index.ts`。只将`https://sapi.k780.com/`的POST报价请求转到明确本机来源，且环境和正文必须都是本次假凭据；其他外部请求拒绝，转发禁用重定向。同项目网关请求原样透传，函数认证、SDK和数据库实现不在这里替换。本批尚未在真实Edge服务接入此启动壳，不能据生成内容推断完整接线已经通过。

Web新增`scripts/learning/exchange-rate-local-source.test.mjs`，七项回归、三个职责：受限纯模块/启动端口、协议与外部边界、并发与回收。用VM加载真实`providers.ts`、`shared.ts`和`nowapi-quotes.ts`，只注入时钟、假环境及fetch，实际通过本次HTTP服务往返；生成壳的末尾import单独换成加载观察端口。SDK透传测试使用合成请求和网络端口，未加载SDK/Auth/数据库，也不将该端口响应算产品成功。原两个受限助手从未读取、导入或执行。

报价夹具只更正一条中文注释，行数不变，语法树完全相同。实际只读查询确认`public.exchange_rate.daily_exchange_rate`为无固定precision/scale的numeric；六位小数只是夹具样本约定，不是数据库原始汇率约束。原`bank_quote / 100`及成交金额计算没有改动。

## 验证与已知未完成

七项专项覆盖原请求和解析、CNY不请求来源、ZZZ明确失败、输入拒绝与脱敏、同项目透传、外部请求拒绝、并发快照独立、超限/坏时钟、端口冲突与重绑回收。第一次专项因测试VM漏注入URLSearchParams失败，补标准全局对象后通过；第一次全集另在端口立即重绑时复用了已关闭的fetch连接，返回ECONNRESET，现用`http.request`的`agent:false`独立连接核对重绑，未添加重试或忽略业务错误。参考[Undici已知连接问题](https://github.com/nodejs/undici/issues/3492)和[Node 24 HTTP文档](https://nodejs.org/docs/latest-v24.x/api/http.html)。两次失败及静态检查器误把SourceFile全文当AST值的失败日志保留。

按web-change-quality-gate的Non-rendered路径：没有应用页面、布局、环境配置或生产函数改动，未新增开发服务/容器，也不重复桌面/手机产品检查。只对本批文件做lint和限定类型检查，报价注释AST及原CLI字节保护；完整回归/生产构建和原产品Auth仍not_run。各最终日志、完整计数及源码摘要见Web`output/learning-real-provider-entry-20261110/final-verification.json`。

新增两份源码在本批审完，原待审关闭0、新增待审0；总量2078→2080、已审2061→2063，待审15和受限2保持。增加的是已完成辅助源码，不是又出现两千份待做工作。当前覆盖仍以[自动覆盖表](manual-review-coverage.md)为准。

原CLI接入、专属完整项目Auth/Edge/SDK连接、容器到主机来源连通性、归属和并发保护、原三次重试的完整终态、独立报价凭证和限定清理均未完成。真实中行凭证、完整产品页面与托管平台重扫也没有验证，整体继续`partial_failed`。本地来源的样本与端口测试不计入真实供应商验收。

各测试服务在after中关闭，回收检查精确复用端口并验证冲突不会关闭原监听；测试进程最终退出。没有产生数据库/Storage夹具或临时环境目录。保留最终证据、失败日志和批前备份，没有可删除的本批缓存或废弃草稿。
