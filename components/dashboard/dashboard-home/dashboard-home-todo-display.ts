import type { UserTodoItemRow } from "@/lib/user-todos";

// 纯展示与表单转换：日期按上海日历判断，筛选与校验不发送请求。
export type HomeTodoFilter = "active" | "all" | "completed";

export type HomeTodoFormState = {
  dueDate: string;
  isCompleted: boolean;
  isImportant: boolean;
  notes: string;
  title: string;
};

export type HomeTodoValidationCopy = {
  notesTooLong: string;
  titleRequired: string;
  titleTooLong: string;
};

export type HomeTodoDueCopy = {
  overdue: (date: string) => string;
  today: string;
  tomorrow: string;
};

const TODO_TITLE_MAX_LENGTH = 120;
const TODO_NOTES_MAX_LENGTH = 2000;

export const homeTodoFilterValues: readonly HomeTodoFilter[] = [
  "active",
  "all",
  "completed",
];

export function createEmptyHomeTodoForm(): HomeTodoFormState {
  return {
    dueDate: "",
    isCompleted: false,
    isImportant: false,
    notes: "",
    title: "",
  };
}

export function createHomeTodoFormFromRow(
  row: UserTodoItemRow,
): HomeTodoFormState {
  return {
    dueDate: row.due_date ?? "",
    isCompleted: row.is_completed,
    isImportant: row.is_important,
    notes: row.notes,
    title: row.title,
  };
}

export function validateHomeTodoForm(
  formState: HomeTodoFormState,
  copy: HomeTodoValidationCopy,
) {
  const title = formState.title.trim();
  const notes = formState.notes.trim();

  if (!title) {
    return copy.titleRequired;
  }

  if (title.length > TODO_TITLE_MAX_LENGTH) {
    return copy.titleTooLong;
  }

  if (notes.length > TODO_NOTES_MAX_LENGTH) {
    return copy.notesTooLong;
  }

  return null;
}

export function toUserTodoMutationInput(formState: HomeTodoFormState) {
  return {
    dueDate: formState.dueDate || null,
    isCompleted: formState.isCompleted,
    isImportant: formState.isImportant,
    notes: formState.notes,
    title: formState.title,
  };
}

export function getHomeTodoCounts(todos: readonly UserTodoItemRow[]) {
  const completed = todos.filter((todo) => todo.is_completed).length;
  const active = todos.length - completed;

  return {
    active,
    all: todos.length,
    completed,
  };
}

export function filterHomeTodos(
  todos: readonly UserTodoItemRow[],
  filter: HomeTodoFilter,
) {
  if (filter === "active") {
    return todos.filter((todo) => !todo.is_completed);
  }

  if (filter === "completed") {
    return todos.filter((todo) => todo.is_completed);
  }

  return [...todos];
}

export function formatHomeTodoDueDate(
  todo: UserTodoItemRow,
  locale: string,
  copy: HomeTodoDueCopy,
) {
  if (!todo.due_date) {
    return "";
  }

  const formattedDate = formatTodoDate(todo.due_date, locale);

  if (todo.is_completed) {
    return formattedDate;
  }

  const today = getShanghaiDateKey();

  if (todo.due_date < today) {
    return copy.overdue(formattedDate);
  }

  if (todo.due_date === today) {
    return copy.today;
  }

  if (todo.due_date === addDaysToDateKey(today, 1)) {
    return copy.tomorrow;
  }

  return formattedDate;
}

export function getHomeTodoDueTone(todo: UserTodoItemRow) {
  if (!todo.due_date || todo.is_completed) {
    return "default" as const;
  }

  const today = getShanghaiDateKey();

  if (todo.due_date < today) {
    return "overdue" as const;
  }

  if (todo.due_date === today) {
    return "today" as const;
  }

  return "default" as const;
}

function formatTodoDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function getShanghaiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);

  return getShanghaiDateKey(date);
}
