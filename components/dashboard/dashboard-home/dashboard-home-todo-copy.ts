import type { UserTodoErrorCopy } from "@/lib/user-todos";
import type {
  HomeTodoDueCopy,
  HomeTodoFilter,
  HomeTodoValidationCopy,
} from "./dashboard-home-todo-display";

/** 首页待办的中英文消息集中在这里，表单转换与实际写入由各自模块维护。 */
export type HomeTodoFeedbackCopy = {
  createSuccess: string;
  deleteConfirm: (title: string) => string;
  deleteSuccess: string;
  updateSuccess: string;
};

export type HomeTodoCopy = {
  actions: {
    add: string;
    cancel: string;
    delete: string;
    edit: string;
    important: string;
    markComplete: string;
    markImportant: string;
    save: string;
    unmarkComplete: string;
    unmarkImportant: string;
  };
  completedLabel: string;
  description: string;
  dialog: {
    completedLabel: string;
    description: string;
    dueDateLabel: string;
    importantLabel: string;
    notesLabel: string;
    notesPlaceholder: string;
    title: string;
    titleLabel: string;
    titlePlaceholder: string;
  };
  due: HomeTodoDueCopy;
  empty: Record<HomeTodoFilter, { description: string; title: string }>;
  errors: UserTodoErrorCopy;
  feedback: HomeTodoFeedbackCopy;
  filters: Record<HomeTodoFilter, (count: number) => string>;
  quickAdd: {
    dueDateLabel: string;
    placeholder: string;
  };
  title: string;
  validation: HomeTodoValidationCopy;
};

type HomeTodoTranslator = (
  key: string,
  values?: Record<string, number | string>,
) => string;

export function createHomeTodoCopy(t: HomeTodoTranslator): HomeTodoCopy {
  return {
    actions: {
      add: t("todos.actions.add"),
      cancel: t("todos.actions.cancel"),
      delete: t("todos.actions.delete"),
      edit: t("todos.actions.edit"),
      important: t("todos.actions.important"),
      markComplete: t("todos.actions.markComplete"),
      markImportant: t("todos.actions.markImportant"),
      save: t("todos.actions.save"),
      unmarkComplete: t("todos.actions.unmarkComplete"),
      unmarkImportant: t("todos.actions.unmarkImportant"),
    },
    completedLabel: t("todos.completedLabel"),
    description: t("todos.description"),
    dialog: {
      completedLabel: t("todos.dialog.completedLabel"),
      description: t("todos.dialog.description"),
      dueDateLabel: t("todos.dialog.dueDateLabel"),
      importantLabel: t("todos.dialog.importantLabel"),
      notesLabel: t("todos.dialog.notesLabel"),
      notesPlaceholder: t("todos.dialog.notesPlaceholder"),
      title: t("todos.dialog.title"),
      titleLabel: t("todos.dialog.titleLabel"),
      titlePlaceholder: t("todos.dialog.titlePlaceholder"),
    },
    due: {
      overdue: (date) => t("todos.due.overdue", { date }),
      today: t("todos.due.today"),
      tomorrow: t("todos.due.tomorrow"),
    },
    empty: {
      active: {
        description: t("todos.empty.activeDescription"),
        title: t("todos.empty.activeTitle"),
      },
      all: {
        description: t("todos.empty.allDescription"),
        title: t("todos.empty.allTitle"),
      },
      completed: {
        description: t("todos.empty.completedDescription"),
        title: t("todos.empty.completedTitle"),
      },
    },
    errors: {
      authRequired: t("todos.errors.authRequired"),
      notFound: t("todos.errors.notFound"),
      notesInvalid: t("todos.errors.notesInvalid"),
      permission: t("todos.errors.permission"),
      titleInvalid: t("todos.errors.titleInvalid"),
      unknown: t("todos.errors.unknown"),
    },
    feedback: {
      createSuccess: t("todos.feedback.createSuccess"),
      deleteConfirm: (title) => t("todos.feedback.deleteConfirm", { title }),
      deleteSuccess: t("todos.feedback.deleteSuccess"),
      updateSuccess: t("todos.feedback.updateSuccess"),
    },
    filters: {
      active: (count) => t("todos.filters.active", { count }),
      all: (count) => t("todos.filters.all", { count }),
      completed: (count) => t("todos.filters.completed", { count }),
    },
    quickAdd: {
      dueDateLabel: t("todos.quickAdd.dueDateLabel"),
      placeholder: t("todos.quickAdd.placeholder"),
    },
    title: t("todos.title"),
    validation: {
      notesTooLong: t("todos.validation.notesTooLong"),
      titleRequired: t("todos.validation.titleRequired"),
      titleTooLong: t("todos.validation.titleTooLong"),
    },
  };
}
