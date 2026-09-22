export type MailIntakeRuleMatcher = "sender" | "domain" | "subject_contains";
export type MailIntakeRuleAction = "allow" | "quarantine";

export type DecryptedMailIntakeRule = {
  id: string;
  matchType: MailIntakeRuleMatcher;
  action: MailIntakeRuleAction;
  pattern: string;
  enabled: boolean;
};

export type MailIntakeDecision = {
  status: "active" | "quarantined";
  reason: string | null;
  ruleId: string | null;
};

export function normalizeMailIntakePattern(matchType: MailIntakeRuleMatcher, pattern: string) {
  const normalized = pattern.trim().toLowerCase();
  if (matchType === "sender") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("请填写完整的发件邮箱地址。");
    return normalized;
  }
  if (matchType === "domain") {
    const domain = normalized.replace(/^@/, "");
    if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(domain)) throw new Error("请填写正确的发件域名。");
    return domain;
  }
  if (normalized.length < 2 || normalized.length > 120) throw new Error("主题关键词需要填写 2 到 120 个字符。");
  return normalized;
}

function ruleMatches(rule: DecryptedMailIntakeRule, sender: string, subject: string) {
  if (!rule.enabled) return false;
  if (rule.matchType === "sender") return sender === rule.pattern;
  if (rule.matchType === "domain") return sender.split("@")[1] === rule.pattern;
  return subject.toLowerCase().includes(rule.pattern);
}

/**
 * 明确放行优先于明确隔离；已有正常业务线程只绕过自动群发识别，不绕过管理员规则。
 * 自动回复头不会触发隔离，避免误伤休假通知和退信。
 */
export function decideMailIntake(input: {
  sender: string;
  subject: string;
  headers: Record<string, string>;
  existingActiveThread: boolean;
}, rules: DecryptedMailIntakeRule[]): MailIntakeDecision {
  const sender = input.sender.trim().toLowerCase();
  const matching = rules.filter((rule) => ruleMatches(rule, sender, input.subject));
  const allowed = matching.find((rule) => rule.action === "allow");
  if (allowed) return { status: "active", reason: null, ruleId: allowed.id };
  const blocked = matching.find((rule) => rule.action === "quarantine");
  if (blocked) return { status: "quarantined", reason: "命中管理员收件规则", ruleId: blocked.id };
  if (input.existingActiveThread) return { status: "active", reason: null, ruleId: null };

  const precedence = input.headers.precedence?.trim().toLowerCase();
  const bulk = Boolean(input.headers["list-unsubscribe"] || input.headers["list-id"] || ["bulk", "list", "junk"].includes(precedence ?? ""));
  return bulk
    ? { status: "quarantined", reason: "系统识别为群发或订阅邮件", ruleId: null }
    : { status: "active", reason: null, ruleId: null };
}
