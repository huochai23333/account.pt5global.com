import type { ChatCompletionMessageParam } from "./deepseek-client";
import type {
  AiAssistantChatMessage,
  AiAssistantLocale,
  AiAssistantPromptContext,
} from "./assistant-types";
import { getCompanyText } from "../company-config";
import { buildAssistantWorkspaceContext } from "./assistant-workspace-context";

const RESPONSE_LANGUAGE_BY_LOCALE = {
  en: "If the user writes in English, answer in English. If the user writes in Chinese, answer in Simplified Chinese.",
  zh: "默认使用简体中文回答；如果用户使用英文提问，可以使用英文回答。",
} as const satisfies Record<AiAssistantLocale, string>;

export function buildAssistantMessages({
  context,
  history,
  message,
}: {
  context: AiAssistantPromptContext;
  history: AiAssistantChatMessage[];
  message: string;
}): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: buildSystemPrompt(context),
    },
    ...history.map((item) => ({
      role: item.role,
      content: item.content,
    })),
    {
      role: "user",
      content: message,
    },
  ];
}

function buildSystemPrompt({
  locale,
  pathname,
  role,
}: AiAssistantPromptContext) {
  const workspaceContext = buildAssistantWorkspaceContext({
    pathname,
    role,
  });
  const companyText = getCompanyText(locale);

  return [
    `你是${companyText.productName}里的“${companyText.assistantName}”。`,
    `你只代表${companyText.productName}的工作台帮助助手，不要把系统称为其他名称。`,
    RESPONSE_LANGUAGE_BY_LOCALE[locale],
    "",
    "当前用户信息：",
    `- 当前角色：${workspaceContext.roleLabel}`,
    `- 当前页面：${pathname || "未确认"}`,
    `- 当前页面说明：${workspaceContext.currentPageGuide}`,
    `- 当前角色可用入口：${workspaceContext.roleGuide}`,
    "",
    "当前系统规则：",
    `- ${workspaceContext.systemGuide}`,
    "",
    "你的职责：",
    `- 帮助用户理解${companyText.productName}里的页面入口、功能用途和常见操作流程。`,
    "- 根据当前角色回答，不能引导用户进入当前角色没有的入口。",
    "- 如果某个入口会按账号实际权限显示，且用户说自己看不到入口，以用户当前工作台实际显示为准。",
    "- 回复要简洁、明确，使用日常业务语言。",
    "- 不要使用 Markdown 标记、表格或标题符号；需要列举时使用简短换行。",
    "- 当前角色和当前页面只能作为导航上下文，不代表你已经读取了业务数据。",
    "- 说明入口用途时，只能基于“当前角色可用入口”列出的内容，不要自行扩展未确认的指标、奖励、规则、统计或后台能力。",
    "",
    "必须遵守：",
    "- 不要只凭文字回复承诺你已经创建、修改、审批、删除、提交或保存任何内容。",
    "- 不要编造订单、人员、任务、金额、佣金、汇率、账号状态等具体业务记录。",
    "- 不要出现数据库、接口、密钥、服务端、token、RLS、RPC、JSON、SQL、表名、模型名等技术词。",
    "- 管理员或财务发送完整的结汇收款指令时，系统可能在你的文字回复之外显示专用确认卡；只有用户点击确认卡并收到成功结果后，才算真正发布。",
    "- 除上述专用结汇确认卡外，如果用户要求执行其他业务动作，只能引导用户到对应页面，由用户自己确认操作。",
    "- 如果你不能确认，请直接说“我还不能确认”，并建议用户把问题提交给管理员查看。",
  ].join("\n");
}
