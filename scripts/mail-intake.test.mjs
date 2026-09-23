import assert from "node:assert/strict";
import test from "node:test";

import {
  addStableAliasSuffix,
  addStableRefSuffix,
  createSuggestedMailAlias,
  createSuggestedRefPrefix,
} from "../lib/mail/mail-agent-identifiers.ts";
import { decideMailIntake, normalizeMailIntakePattern } from "../lib/mail/mail-intake.ts";
import { buildOutboundRecipientAddresses } from "../lib/mail/mail-recipient-addresses.ts";
import { decideMailRouting } from "../lib/mail/mail-routing.ts";

const USER_ID = "12345678-90ab-4cde-8f01-234567890abc";

test("英文用户名生成可读别名与 Ref", () => {
  const alias = createSuggestedMailAlias({ userId: USER_ID, name: "Alice_Song", email: "alice@example.com" });
  assert.equal(alias, "alice.song");
  assert.equal(createSuggestedRefPrefix(alias, USER_ID), "ALICESONG");
});

test("中文、空名称与超长名称使用稳定回退", () => {
  assert.equal(createSuggestedMailAlias({ userId: USER_ID, name: "宋爱丽", email: "alice.song@example.com" }), "alice.song");
  assert.equal(createSuggestedMailAlias({ userId: USER_ID, name: "", email: "x@example.com" }), "sales-12345678");
  const longAlias = createSuggestedMailAlias({ userId: USER_ID, name: "a".repeat(60), email: "a@example.com" });
  assert.equal(longAlias.length, 40);
  assert.equal(createSuggestedRefPrefix(longAlias, USER_ID), "AAAAAAAAAAA1234");
});

test("重复值追加稳定短码且满足长度限制", () => {
  const alias = addStableAliasSuffix("a".repeat(40), USER_ID);
  const ref = addStableRefSuffix("VERYLONGPREFIX12", USER_ID);
  assert.equal(alias, `${"a".repeat(33)}-123456`);
  assert.equal(alias.length, 40);
  assert.equal(ref, "VERYLONGPRE1234");
  assert.equal(ref.length, 15);
});

test("规则内容规范化并拒绝无效值", () => {
  assert.equal(normalizeMailIntakePattern("sender", " Buyer@Example.COM "), "buyer@example.com");
  assert.equal(normalizeMailIntakePattern("domain", "@Example.COM"), "example.com");
  assert.throws(() => normalizeMailIntakePattern("sender", "not-an-email"), /完整/);
  assert.throws(() => normalizeMailIntakePattern("subject_contains", "x"), /2 到 120/);
});

test("明确放行优先于隔离规则和群发头", () => {
  const decision = decideMailIntake({
    sender: "buyer@example.com",
    subject: "Weekly offer",
    headers: { "list-unsubscribe": "<https://example.com/unsubscribe>" },
    existingActiveThread: false,
  }, [
    { id: "block", matchType: "domain", action: "quarantine", pattern: "example.com", enabled: true },
    { id: "allow", matchType: "sender", action: "allow", pattern: "buyer@example.com", enabled: true },
  ]);
  assert.deepEqual(decision, { status: "active", reason: null, ruleId: "allow" });
});

test("明确隔离优先于已有会话", () => {
  const decision = decideMailIntake({
    sender: "buyer@example.com", subject: "Re: order", headers: {}, existingActiveThread: true,
  }, [{ id: "block", matchType: "sender", action: "quarantine", pattern: "buyer@example.com", enabled: true }]);
  assert.equal(decision.status, "quarantined");
  assert.equal(decision.ruleId, "block");
});

test("已有会话绕过自动群发识别，陌生群发进入隔离区", () => {
  const input = { sender: "buyer@example.com", subject: "Re: order", headers: { precedence: "bulk" } };
  assert.equal(decideMailIntake({ ...input, existingActiveThread: true }, []).status, "active");
  assert.equal(decideMailIntake({ ...input, existingActiveThread: false }, []).status, "quarantined");
});

test("自动回复标记与普通来信不会单独触发隔离", () => {
  const decision = decideMailIntake({
    sender: "buyer@example.com",
    subject: "Automatic reply: holiday",
    headers: { "auto-submitted": "auto-replied" },
    existingActiveThread: false,
  }, []);
  assert.deepEqual(decision, { status: "active", reason: null, ruleId: null });
});

test("成功收件地址覆盖主送抄送密送并排除公司邮箱", () => {
  assert.deepEqual(buildOutboundRecipientAddresses({
    to: ["Buyer@Example.com", "chinapt5@gmail.com"],
    cc: ["buyer@example.com", "finance@example.com", "chinapt5+alice@gmail.com"],
    bcc: ["hidden@example.com"],
    mailboxEmail: "chinapt5@gmail.com",
  }), [
    { email: "buyer@example.com", kind: "to" },
    { email: "finance@example.com", kind: "cc" },
    { email: "hidden@example.com", kind: "bcc" },
  ]);
});

const ROUTING_AGENTS = [
  { memberId: "alice", aliasLocalPart: "alice", refPrefix: "ALICE", displayName: "Alice", enabled: true },
  { memberId: "bob", aliasLocalPart: "bob", refPrefix: "BOB", displayName: "Bob", enabled: true },
];

function routeWithHistory(recipientHistoryMemberIds) {
  return decideMailRouting({
    recipientHistoryMemberIds,
    deliveredTo: [],
    to: ["chinapt5@gmail.com"],
    cc: [],
    subject: "Direct inquiry",
    textBody: "Hello",
    htmlBody: "",
  }, ROUTING_AGENTS);
}

test("已联系邮箱只有一个有效负责人时直接分配", () => {
  const decision = routeWithHistory(["alice", "alice"]);
  assert.equal(decision.assignedMemberId, "alice");
  assert.equal(decision.source, "recipient_history");
});

test("已联系邮箱存在多个负责人时保持待指派", () => {
  const decision = routeWithHistory(["alice", "bob"]);
  assert.equal(decision.assignedMemberId, null);
  assert.equal(decision.source, "unassigned");
  assert.equal(decision.conflicting, true);
});

test("历史负责人已停用时不会自动改派", () => {
  const decision = routeWithHistory(["disabled-user"]);
  assert.equal(decision.assignedMemberId, null);
  assert.equal(decision.source, "unassigned");
});
