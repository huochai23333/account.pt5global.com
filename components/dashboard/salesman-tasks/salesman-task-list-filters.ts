import { normalizeSearchText } from "@/lib/value-normalizers";
import type { SalesmanTaskFocusFilter } from "@/lib/salesman-task-route";
import type { SalesmanTaskRow } from "@/lib/salesman-tasks";

const OWN_TASK_STATUS = {
  in_progress: "accepted",
  reviewing: "reviewing",
  rejected: "rejected",
  completed: "completed",
} as const;

export function filterSalesmanTaskList(
  tasks: SalesmanTaskRow[],
  searchText: string,
  focus: SalesmanTaskFocusFilter,
  viewerId: string | null,
) {
  const normalizedText = normalizeSearchText(searchText);

  return tasks.filter((task) => {
    if (!matchesTaskFocus(task, focus, viewerId)) return false;
    if (!normalizedText) return true;

    const searchableText = [
      task.task_name,
      task.task_intro,
      task.task_type_label,
      task.review_reject_reason,
    ]
      .map((value) => normalizeSearchText(value))
      .filter(Boolean)
      .join(" ");

    return searchableText.includes(normalizedText);
  });
}

function matchesTaskFocus(
  task: SalesmanTaskRow,
  focus: SalesmanTaskFocusFilter,
  viewerId: string | null,
) {
  if (focus === "all") return task.status !== "completed";
  if (focus === "available") return task.status === "to_be_accepted";
  // 列表只筛选服务端已准入的数据，处理中等栏目还需匹配本人领取记录。
  return task.status === OWN_TASK_STATUS[focus] && task.accepted_by_user_id === viewerId;
}
