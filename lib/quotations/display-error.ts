/** 把数据库和存储的内部错误转成业务员能够直接理解的页面提示。 */
export function quoteDisplayError(cause: unknown, fallback: string): string {
  const message = cause && typeof cause === "object" && "message" in cause
    ? String(cause.message) : String(cause ?? "");
  if (cause && typeof cause === "object" && "name" in cause && cause.name === "RequestTimeoutError")
    return "This is taking too long. Check your quotations, then try again.";
  if (message.startsWith("partial_failed:")) return message.slice("partial_failed:".length).trim();
  if (message.includes("quotation_revision_conflict_or_missing"))
    return "This quotation has changed or was removed. Refresh the page before saving again.";
  if (message.includes("quotation_save_not_confirmed") || message.includes("quotation_save_receipt_invalid"))
    return "The quotation could not be confirmed as saved. Please try again.";
  if (message.includes("quotation_delete_not_confirmed"))
    return "The quotation could not be confirmed as deleted. Please refresh the list.";
  if (message.includes("quotation_forbidden") || message.includes("quotation_image_forbidden"))
    return "Your account cannot use this quotation.";
  if (/^(Use a |Image |Product |Some product |Please sign in|PDF generation |Could not )/.test(message))
    return message;
  return fallback;
}
