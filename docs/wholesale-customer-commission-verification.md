# 批发费用与客户提成验证报告

验证日期：2026-10-08，上海时间。采用 web-change-quality-gate 的 Critical write 路径：费用、客户分类、提成和参数版本会改变真实账目。

## 已完成的本地验证

- 复用 localhost:3100 的现有开发服务，没有启动第二个服务；数据库为本地 Docker supabase_db_pt5-dropshipping。
- 专用迁移先在事务中预演，包含把已有提成设为已结算的夹具，确认重算后结算状态、时间和人员不变。故意破坏客户支付金额时，校验拒绝并回滚；随后正常应用本次迁移。最终修订的快照列、函数和审计校验也已在本地事务执行。
- 本地迁移历史原有 20261001072039、20261002053000 两条缺项。没有补跑无关迁移；本次单独执行并登记 20261008093757。云端这两条已存在，CLI 对照仓库文件的远端历史仅缺本次迁移。
- 专项 SQL `wholesale_customer_commission_and_fees.sql`：34 条断言通过，0 失败。覆盖截止前一刻、整点、之后、创建时间不可回填、分类不可改、全款前零提成、老客户毛利/新客户服务费、亏损、费用篡改、零成本、逐项舍入、成本和客户变更、已结算记录冻结、旧订单版本不变、新订单用新比例、发布去重、版本冲突及退役规则不可发布。
- 7 个 SQL 回归文件全部通过：business_parameter_versions、wholesale_order_direct_edits、wholesale_order_creation_idempotency、wholesale_order_page、wholesale_client_access_and_order_lists、finance_wholesale_permissions、wholesale_settlement_releases。参数回归包含预约生效和取消。每个文件在事务中回滚自己的测试数据。
- `wholesale_financial_revision_readback.sql` 独立只读核对：费用、版本快照、提成、规则、客户分类不一致均为0；毛利/客户支付变化为0；结算凭证变化为0；缺少修改后快照为0；单位毛利列为0。本地最终恢复为5客户、100订单。
- `node --experimental-strip-types --test scripts/wholesale-order-fees.test.mjs`：4通过、0失败、0跳过。B=10000得到500/300/108；B=2.31得到0.12/0.07/0.03，能识别未逐项舍入会错误得到0.02的实现。
- 类型检查、Lint、双语文案检查、工作台结构检查、操作成功契约检查全部通过；契约检查为41项、928个源码文件。数据库 public/private lint 无错误。
- `npm run build` 成功：webpack编译、TypeScript及52个静态页面生成全部完成。

## 真实页面与独立凭证

`PLAYWRIGHT_BASE_URL=http://localhost:3100`、`PLAYWRIGHT_SKIP_WEB_SERVER=1`，一名worker运行 `tests/e2e/wholesale-customer-commission-fees.spec.ts`：最终一次6通过、0失败、0跳过，耗时2.2分钟。初次定位失败和修正后的重复执行不累加为新增覆盖。

| 入口与操作 | 最终业务证据 |
| --- | --- |
| 管理员订单页 → 新客户建单 → 分两次登记结汇 → 修改产品成本 | PostgreSQL独立读取订单ID，费用500/300/108，客户金额12300；首笔3000后提成0，补9300后毛利2000、提成50；成本增至11000后毛利-500、服务费625、提成62.50，付款金额仍12300。刷新订单及提成页仍一致。 |
| 业务员订单页 → 老客户新建订单 → 全款登记结汇 | 同样成本和收款，毛利2000，锁定比例12%，提成240；刷新后真实毛利仍显示。 |
| 财务订单页 → 375px新建表单 → 保存 → 订单详情 | 只读预览500/300/108，独立数据库核对保存订单；刷新详情三项费用存在，页面宽度不超过375px。 |
| 客户订单页 → 搜索已有订单 | 原始响应有真实订单；不包含三项费用、提成基数和订单计算快照，汇总也不返回费用，不能创建订单。 |
| 管理员订单页 → 编辑已被删除的订单 | 数据库实际影响0行；草稿保留，没有成功提示。 |
| 管理员参数中心 → 两个客户比例 → 发布 → 断线重试 → 刷新 | 真实新版本ID `540acbc2-bc87-4c04-8da6-6e3f721fc5ed`，版本2，实际新增1条。响应丢失后的重试仍是同一ID；刷新显示版本2和真实比例。清除管理员会话后，真实业务员无法进入设置。 |

独立读取通过Docker内PostgreSQL进行，页面写入使用实际账号和实际Supabase接口；没有替换页面或使用静态页面假冒验收。普通service_role没有客户底表INSERT权限，夹具准备改为只针对本次客户、订单的本地PostgreSQL写入，没有放宽应用授权。测试结束按自身ID删除夹具和自身发布的版本，保留其他记录和历史版本。

新客户、手机页面的浏览器console error与pageerror断言为空；页面未出现框架错误覆盖。已人工查看1280×720桌面、375×812手机表单/详情和参数对话框截图：费用、公式可读，无横向溢出；长表单在弹窗内部滚动。

截图保留在忽略目录：output/wholesale-fees-desktop-form.png、wholesale-fees-mobile-form.png、wholesale-fees-mobile.png、wholesale-fees-settings.png。

## 失败与中断矩阵

| 场景 | 实际检查结果 |
| --- | --- |
| 影响0行 | 删除自身夹具后从编辑表单保存，没有成功提示。 |
| 缺少必填资料 | 新建空表单提交仍停在表单，本次客户订单数量为0。 |
| 权限不足 | 客户无新建入口且原始数据无内部字段；业务员参数设置受拒；财务权限另经SQL回归。 |
| 超时 | 参数请求阻断35秒，超过真实30秒上限；显示超时，草稿保留，数据库没有版本。 |
| HTTP成功但业务未完成 | 仅返回伪造版本凭证、数据库不写入；最终回读失败，没有发布成功提示。 |
| 重复提交 | 参数提交后断线，真实落库，再重试；独立查询仍只有1条同版本。建单SQL也验证同请求只创建1订单。 |
| 提交后断线 | 实际发布请求先完成数据库提交，再断开响应；重试与刷新均解析同一真实版本。 |
| 部分完成 | 本次历史重算为单事务；故意破坏不变量时整体回滚。没有独立多目标逐个执行的账目路径。发布目标部分失败会报告partial_failed。 |
| worker中断 | not_applicable：本次计算和发布都同步在数据库事务完成，没有异步任务或外部消息。 |

红/绿验证：把本次新客户提成暂改为51，金额50的独立断言确认拒绝；恢复50后继续编辑并核对62.50。仅修改自身本地夹具。迁移负例同样证实不变量失败会回滚。

## README与模块边界

两个README已记录客户永久分类、两个比例、逐项费用计算、原毛利不变、已结算冻结及历史受控重算。Web原有单位毛利和金额分档说明已清理，中文英文公式同步维护。

纯费用计算、费用预览状态、只读展示分别拆入lib/wholesale-order-fees.ts、use-wholesale-order-fees.ts、wholesale-order-fee-fields.tsx。页面继续组装现有查询/提交模块；表格与详情负责展示，设置数据适配器负责参数读写及响应归一化。没有新增承担查询、权限和写入的Page/Client核心组件。以下文件均不超过500行。

| 改动源码 | 修改前行数 | 修改后行数 |
| --- | ---: | ---: |
| components/dashboard/commission/business-parameter-edit-dialog.tsx | 282 | 278 |
| components/dashboard/commission/commission-settings-display.ts | 266 | 252 |
| components/dashboard/wholesale/wholesale-commission-records.tsx | 243 | 243 |
| components/dashboard/wholesale/wholesale-commission-settings.ts | 35 | 15 |
| components/dashboard/wholesale/wholesale-order-details-dialog.tsx | 261 | 260 |
| components/dashboard/wholesale/wholesale-order-edit-dialog.tsx | 331 | 339 |
| components/dashboard/wholesale/wholesale-order-form-dialog.tsx | 239 | 243 |
| components/dashboard/wholesale/wholesale-order-summary.tsx | 69 | 77 |
| components/dashboard/wholesale/wholesale-orders-table.tsx | 353 | 359 |
| lib/commission-settings.ts | 389 | 389 |
| lib/wholesale-order-assessment-messages.ts | 269 | 272 |
| lib/wholesale-order-page-decoders.ts | 94 | 97 |
| lib/wholesale-order-page.ts | 191 | 194 |
| lib/wholesale-row-queries.ts | 25 | 25 |
| lib/wholesale-types.ts | 194 | 214 |
| lib/workspace-wholesale-module.ts | 130 | 130 |
| lib/wholesale-order-fees.ts | 0 | 33 |
| components/dashboard/wholesale/use-wholesale-order-fees.ts | 0 | 23 |
| components/dashboard/wholesale/wholesale-order-fee-fields.tsx | 0 | 26 |

## 发布与未验证范围

用户授权顺序：本地验证通过 → 上传两个仓库本次改动 → 云端迁移。云端预读仍为51老客户、103订单、96全款，已结算提成0，预计80比例/71金额变化。CLI migration list确认仅本次缺少；include-all dry-run也只列本次文件，无无关待发布迁移。

发布结果：待本次实际上传和云端执行后填写。

未执行两份需要重置共享参数历史的原有Playwright文件：business-parameter-settings.spec.ts、business-parameter-order-lock.spec.ts。其新规则字段已更新，未冒充已通过；本次使用不重置共享历史的独立6场景和真实SQL回归验证规则。全量E2E套件未运行。预约时间的自然流逝、英文实际浏览器布局、生产网站页面及Hostinger部署尚未验证；预约解析已通过本地SQL，英文文案结构检查已通过。旅游服务计算不在本次修改范围。
