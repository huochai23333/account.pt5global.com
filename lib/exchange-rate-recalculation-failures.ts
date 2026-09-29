/** 只把已知业务原因映射成页面文案；数据库内部错误保留在审计记录，不直接显示。 */
export function recalculationFailureKey(message: string) {
  if (message.includes("买入价尚未准备好")) return "missingQuote";
  if (message.includes("佣金原计算参数不完整")) return "missingParameters";
  if (message.includes("原参数版本不一致")) return "parameterVersion";
  if (message.includes("发生变化")) return "changed";
  return "unknown";
}
