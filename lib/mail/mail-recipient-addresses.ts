export type MailRecipientKind = "to" | "cc" | "bcc";

export type MailRecipientAddress = {
  email: string;
  kind: MailRecipientKind;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/** 从 RFC 邮件头中提取规范化邮箱；显示名称不会参与匹配。 */
export function extractEmailAddresses(value: string) {
  return [...value.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
    .map((match) => normalizeEmail(match[0]));
}

/**
 * 公司邮箱的 Gmail 加号地址仍然属于公司自己，不能因为业务员把公司地址放进抄送，
 * 就把这个地址误登记成“已经联系过的客户”。
 */
function isSharedMailboxAddress(email: string, mailboxEmail: string) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedMailbox = normalizeEmail(mailboxEmail);
  const [mailboxLocal = "", mailboxDomain = ""] = normalizedMailbox.split("@");
  const [local = "", domain = ""] = normalizedEmail.split("@");
  return domain === mailboxDomain && (local === mailboxLocal || local.startsWith(`${mailboxLocal}+`));
}

/**
 * 依次处理主送、抄送和密送。同一个邮箱如果被重复填写，只保留第一次出现的收件类型，
 * 这样数据库中的唯一约束和页面实际看到的收件顺序保持一致。
 */
export function buildOutboundRecipientAddresses(input: {
  to: string[];
  cc: string[];
  bcc: string[];
  mailboxEmail: string;
}) {
  const seen = new Set<string>();
  const output: MailRecipientAddress[] = [];
  const groups: Array<[MailRecipientKind, string[]]> = [
    ["to", input.to],
    ["cc", input.cc],
    ["bcc", input.bcc],
  ];

  for (const [kind, values] of groups) {
    for (const value of values) {
      const email = normalizeEmail(value);
      if (!email || seen.has(email) || isSharedMailboxAddress(email, input.mailboxEmail)) continue;
      seen.add(email);
      output.push({ email, kind });
    }
  }
  return output;
}
