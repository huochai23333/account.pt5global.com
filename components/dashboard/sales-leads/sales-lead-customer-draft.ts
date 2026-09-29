import type { SalesLead } from "@/lib/sales-leads-types";

/** 全部联系方式按原文合并，保留渠道名称，避免只复制第一项后丢失客户其他联系方式。 */
export function createSalesLeadCustomerDraft(lead: SalesLead, labels: Record<string, string>) {
  const contacts = (["email", "phone", "whatsapp", "website_url", "public_contact", "community_url"] as const)
    .filter((key) => lead[key]?.trim())
    .map((key) => `${labels[key]}: ${lead[key]!.trim()}`);
  return {
    uniqueName: lead.name, contactDetails: contacts.join("\n"), otherNames: "", notes: "",
    source: `${labels.source}: ${lead.primary_source_lead_id}\n${lead.source_url}`,
  };
}

export function splitSalesLeadCustomerNames(value: string) {
  return Array.from(new Set(value.split(/\r?\n/).map((name) => name.trim()).filter(Boolean)));
}
