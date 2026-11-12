# 库存订单、附件与专属信贷

库存订单记录为客户购买的货物与付款。订单表保存购买金额、信贷抵消、实付、余额和修订号。专属信贷另有申请、延期、还款和审计表。

| 我想维护什么 | 从哪里开始 |
| --- | --- |
| 找到页面和数据 | 工作台的「库存订单」进入 `/[workspace]/wholesale/inventory-orders`。[批发工作台渲染](../../../app/%28workspace%29/%5Bworkspace%5D/%5Bbusiness%5D/%5Bsection%5D/wholesale-section-page.tsx)用当前会话调用[数据装载器](../../../lib/customer-inventory.ts)，再交给[页面组装](../../../components/dashboard/customer-inventory/customer-inventory-client.tsx)。 |
| 改订单、信贷筛选 | [订单筛选 Hook](../../../components/dashboard/customer-inventory/use-customer-inventory-order-filters.ts)和[信贷筛选 Hook](../../../components/dashboard/customer-inventory/use-customer-inventory-credit-filters.ts)负责筛选已获授权的记录。日期比较采用上海业务日。 |
| 调整商品表单 | [商品编辑器](../../../components/dashboard/customer-inventory/customer-inventory-order-item-editor.tsx)将整组商品整理为同一个请求。[商品弹窗](../../../components/dashboard/customer-inventory/customer-inventory-items-dialog.tsx)提交当前订单和修订号，数据库确认后刷新。 |
| 排查附件上传 | [上传 Hook](../../../components/dashboard/customer-inventory/use-inventory-attachment-upload.ts)按订单持有选中文件和待核对路径。[附件服务](../../../lib/customer-inventory-attachments.ts)先写私有桶 `customer-inventory-order-lists`，[登记核对](../../../lib/customer-inventory-attachment-registration.ts)再按订单和本次路径查登记及对象。 |
| 理解信贷生命周期 | [弹窗入口](../../../components/dashboard/customer-inventory/customer-inventory-credit-dialogs.tsx)按客户申请、审核、直接启用、延期或还款分流。[后端数据库指南](../../../../PT5-dropshipping-supabase/docs/onboarding/database.md)列出现行权限与业务凭证。 |

管理员、业务员和财务通过工作台能力获得维护入口。客户身份只能读绑定账号对应的订单、商品和附件，并能提交自己的信贷及延期申请。数据库再次检查有效会话、批发访问及客户归属。

当前按钮能力来自[批发岗位能力](../../../lib/wholesale-role-permissions.ts)，数据库以有效会话、业务访问与真实岗位执行最终判断。财务协作是后续迁移加入的规则；历史文件中的初始岗位范围不能替代现行定义。客户申请/延期的归属专项目前延期处理，尚未取得该专项的业务验证结论。

建单和改单都必须提交至少一件商品。商品替换会产生新商品编号，同时推进订单修订号；已结清订单仍可改商品和备注，取消订单不可以。固定 200 美元首次批准后的资格与尚未还清的信贷是两回事，后续复用由后台在新订单启用。按[库存历史分段指南](../../../../PT5-dropshipping-supabase/docs/onboarding/inventory-order-credit-history.md)追踪原始表、函数、授权和审计，不需要一次通读上千行。

附件登记如果明确被数据库拒绝，仅清理本次未登记对象。回执或读回不确定时保留对象和原路径。当前页面点「核对本次上传」会重新核对，避免重复上传。已登记附件可以通过刷新后的订单读取。浏览器完全关闭后，尚无登记的待核对路径需要专项恢复验证。

维护金额、档位、延期或逾期利息时以现行数据库函数为准。页面金额、到期日、预估利息用于展示。核对写入时要查看订单编号、前后修订号及对应的申请、还款或审计行。汇率缺失的审核应显示待补条件。

使用专属本地夹具运行 `npm run test:learning:browser -- customer-inventory-attachment-recovery`。库存和信贷数据库断言使用隔离实例的 [SQL 回归](../../../../PT5-dropshipping-supabase/supabase/tests/customer_inventory_orders_and_credit.sql)。

SQL总入口现按原顺序包含四组业务文件，查找建单/审核/Storage/还款见[SQL维护手册](../../../../PT5-dropshipping-supabase/docs/onboarding/inventory-sql-tests.md)。父文件须由psql按文件包含，不能读成字符串后直接执行相对路径。当前只实跑了经理/财务/管理员三个员工场景；客户归属专项继续暂缓，完整套件未执行。

## 维护库存浏览器用例

从[八个原用例的入口](../../../tests/e2e/customer-inventory-orders.spec.ts)找到场景，再按实际路径选择维护文件。

| 维护内容 | 文件 |
| --- | --- |
| 管理员建单与筛选、业务员复用与维护商品、经理入口 | [订单页面场景](../../../tests/e2e/helpers/inventory-order-pages.ts) |
| 客户申请与延期、财务审核与还款 | [信贷页面场景](../../../tests/e2e/helpers/inventory-credit-pages.ts) |
| 客户资格提示、手机订单卡片与只读弹窗 | [只读页面场景](../../../tests/e2e/helpers/inventory-order-read-pages.ts) |
| 页面写入与数据库确认 | [页面凭证](../../../tests/e2e/helpers/inventory-order-page-receipts.ts)与[夹具状态](../../../tests/test-support/inventory-order-fixture.ts) |
| 精确清理和清理结果 | [事务 SQL](../../../tests/test-support/inventory-order-fixture-sql.ts) |

先在专属项目确认种子订单和隔离状态。页面发起操作后，以请求中的精确目标、创建返回的 ID 和数据库审计行为准。列表和信贷卡片使用数据库订单号定位，金额相同也能区分。收到写入结果后还需核对订单修订号、信贷或还款状态，并刷新页面验证。

清理前锁定夹具涉及的表，再核对已确认快照和影响行数。发现附件、额外事务或不明响应时保留专属实例，按审计 ID 查询实际提交结果。此测试的附件场景只读，清理也保留 Storage 对象和登记行。

`node --test scripts/learning/inventory-order-fixture.test.mjs` 可以独立验证夹具逻辑。原浏览器套件仍为未执行，客户归属、空值专项继续暂缓。[本轮证据](../reference/verification-2026-11-11-inventory-web.md)
