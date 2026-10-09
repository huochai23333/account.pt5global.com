/** 动态行由原脚本逐次恢复；较长的操作记录给予有限等待，仍保留明确的失败出口。 */
export function documentRestoreBudget(state: Record<string, unknown>) {
  const actions = state.format === "pt5.form.v1" && Array.isArray(state.actions) ? state.actions.length : 0;
  return Math.min(120000, 15000 + actions * 50);
}
