import { getLocale, getTranslations } from "next-intl/server";

import { getAuthShellCopy } from "./auth-shell-content";
import { companyConfig } from "./company-config";
import type { LegalPageCopy, LegalSection } from "./legal-content";
import { normalizeLocale, type Locale } from "./locale";

type HelpCenterContent = {
  description: string;
  lastUpdated: string;
  metadataTitle: string;
  notice: string;
  sections: LegalSection[];
  title: string;
};

// 帮助内容按当前批发业务任务编排；入口名称应与工作台菜单一致。
const HELP_CENTER_CONTENT: Record<Locale, HelpCenterContent> = {
  zh: {
    metadataTitle: "帮助中心",
    title: "帮助中心",
    description:
      "按你的工作任务查找批发订单、客户跟进、报销、结汇和邮件的操作方法。",
    lastUpdated: "2026-09-23",
    notice:
      "如果页面提示无法继续、资料长时间没有变化，或可见内容不符合你的工作范围，请联系系统管理员核对账号和业务关系。",
    sections: [
      {
        title: "登录与账号",
        items: [
          "忘记密码时，可以在登录页选择找回密码，并按照邮件中的提示重新设置。",
          "如果账号无法登录，请先确认邮箱、密码和验证码是否填写正确；仍无法进入时，请联系管理员核对账号状态。",
          "如果登录后进入的工作台不符合你的实际岗位，请联系管理员核对账号角色和批发业务权限。",
        ],
      },
      {
        title: "客户查单与业务员跟进",
        items: [
          "客户可在“批发订单”按订单号查找自己的订单，查看金额、物流公司、负责业务员和 Order List 附件。需要确认发货进度时，请联系页面上的负责业务员。",
          "业务员可在“线索”查看线索大厅和我的线索；认领后从详情记录联系与跟进。若我的线索为空，可返回线索大厅领取。",
          "业务员和管理员在“批发订单”筛选日期或输入完整单号；跨日期找单时使用“跨日期查此单号”。",
        ],
      },
      {
        title: "报销、结汇和库存信贷",
        items: [
          "运营可在“报销记录”新增费用，填写发生日期、金额和内容；保存后可在记录中查看。",
          "财务可在“结汇发布”登记收款的客户、金额、币种和日期；核对记录后再分配到相同客户、相同币种的订单。",
          "客户可在“库存订单”查看应付金额和商品明细；申请信贷时，先核对页面显示的额度估算、审批条件和还款说明。",
        ],
      },
      {
        title: "邮件与发件结果",
        items: [
          "管理员和业务员可从左侧菜单进入“邮件工作台”，按负责人或未读状态找邮件；打开会话后可回复或转交。",
          "点击发送后等待页面确认公司邮箱的已发送记录。若提示仍在核对，请使用“继续核对”，不要重新写一封相同邮件发送。",
        ],
      },
      {
        title: "需要人工协助",
        items: [
          "遇到无法自行处理的问题时，请准备好账号邮箱、所在页面、操作时间和页面提示内容，方便管理员快速定位。",
          "登录后可点工作台顶栏的“问题反馈”提交问题；无法登录时可发邮件至 " + companyConfig.supportEmail + "。",
        ],
      },
    ],
  },
  en: {
    metadataTitle: "Help Center",
    title: "Help Center",
    description:
      "Find help for wholesale orders, lead follow-up, reimbursements, settlements, and mail.",
    lastUpdated: "2026-09-23",
    notice:
      "If a page says you cannot continue, your profile status has not changed for a long time, or the visible content does not match your work, contact an administrator to check your account and business relationship.",
    sections: [
      {
        title: "Sign-In and Account",
        items: [
          "If you forget your password, use the password recovery option on the sign-in page and follow the instructions in the email.",
          "If you cannot sign in, first check your email, password and verification code. If the issue continues, ask an administrator to check your account status.",
          "If you land in the wrong workspace after signing in, ask an administrator to check your role and wholesale access.",
        ],
      },
      {
        title: "Customer Orders and Lead Follow-up",
        items: [
          "Customers can find their own orders in Wholesale Orders and view the amount, courier, sales contact, and Order List attachments. Ask the sales contact about shipping progress.",
          "Sales staff can open Leads to browse and claim available leads, then record contact and follow-up in the lead details.",
          "Sales staff and administrators can filter Wholesale Orders by date or search by a full order number across dates.",
        ],
      },
      {
        title: "Reimbursements, Settlements, and Credit",
        items: [
          "Operators can add an item in Reimbursements with its date, amount, and description, then check the saved record.",
          "Finance staff can record the customer, amount, currency, and date in Settlement Releases, then allocate the payment to orders for the same customer and currency.",
          "Customers can review amounts and items in Inventory Orders. Check the estimated credit, approval conditions, and repayment details before applying.",
        ],
      },
      {
        title: "Mail and Send Status",
        items: [
          "Administrators and sales staff can open Mail Workspace from the side menu, filter conversations, and reply or assign them from the conversation view.",
          "After sending, wait for confirmation from the company mailbox. If verification is still pending, use Continue checking for the same message.",
        ],
      },
      {
        title: "Getting Human Help",
        items: [
          "When you need help, prepare your account email, the page you were using, the time of the operation and the message shown on the page.",
          "After signing in, use Issue Feedback in the workspace header. If you cannot sign in, email " + companyConfig.supportEmail + ".",
        ],
      },
    ],
  },
};

export async function getHelpCenterPageCopy(): Promise<LegalPageCopy> {
  const [commonT, locale, authShellCopy] = await Promise.all([
    getTranslations("Legal.common"),
    getLocale(),
    getAuthShellCopy(),
  ]);
  const content = HELP_CENTER_CONTENT[normalizeLocale(locale)];

  return {
    backHome: commonT("backHome"),
    brandSubtitle: authShellCopy.brandSubtitle,
    brandTitle: authShellCopy.brandTitle,
    description: content.description,
    draftNotice: content.notice,
    eyebrow: content.title,
    lastUpdated: content.lastUpdated,
    lastUpdatedLabel: commonT("lastUpdatedLabel"),
    nav: {
      privacy: commonT("nav.privacy"),
      terms: commonT("nav.terms"),
      help: commonT("nav.help"),
    },
    sections: content.sections,
    title: content.title,
  };
}

export async function getHelpCenterMetadata() {
  const locale = normalizeLocale(await getLocale());
  const content = HELP_CENTER_CONTENT[locale];

  return {
    description: content.description,
    title: content.metadataTitle,
  };
}
