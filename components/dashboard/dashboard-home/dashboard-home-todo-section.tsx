/** 首页待办区组合快捷录入、筛选和列表；请求、表单状态及完整列表弹窗由待办 Hook 管理。 */
"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import * as FormControls from "@/components/ui/form-controls";

import { ListTodo, LoaderCircle, Plus, Star } from "lucide-react";

import { MotionList, MotionListItem, PresenceSwap } from "@/components/motion/motion-primitives";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";

import { EmptyState, FeedbackNotice } from "../dashboard-shared-ui";
import { HomeTodoDeleteDialog, HomeTodoDialog } from "./dashboard-home-todo-dialog";
import type { HomeTodoCopy } from "./dashboard-home-todo-copy";
import { homeTodoFilterValues } from "./dashboard-home-todo-display";
import { TodoFilterButton, TodoItem } from "./dashboard-home-todo-list";
import type { DashboardHomeTodosState } from "./use-dashboard-home-todos";

type HomeTodosSectionProps = {
  copy: HomeTodoCopy;
  density?: "comfortable" | "compact";
  frame?: "card" | "plain";
  state: DashboardHomeTodosState;
  locale: string;
};

export function HomeTodosSection({
  copy,
  density = "comfortable",
  frame = "card",
  state: todoState,
  locale,
}: HomeTodosSectionProps) {
  const emptyCopy = copy.empty[todoState.filter];
  const createPending = todoState.pendingAction === "create";
  const compact = density === "compact";

  return (
    <section
      className={cn(
        frame === "card"
          ? "rounded-surface-panel border border-surface-panel-border bg-surface-panel p-6 shadow-surface-interactive xl:p-8"
          : "flex h-full min-h-0 flex-col overflow-hidden",
      )}
      data-testid="home-todos-section"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3
            className={cn(
              "flex items-center gap-2 font-bold tracking-tight text-content-strong",
              compact ? "text-lg" : "text-2xl",
            )}
          >
            <ListTodo className={cn("text-primary", compact ? "size-5" : "size-6")} />
            {copy.title}
          </h3>
          {!compact ? (
            <p className="mt-2 text-sm leading-7 text-content-muted">{copy.description}</p>
          ) : null}
        </div>
      </div>

      <form
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 rounded-surface-panel border border-border-subtle bg-surface-inset md:grid-cols-[minmax(0,1fr)_160px_auto_auto] md:gap-3",
          compact ? "mt-2 p-3" : "mt-6 p-4",
          frame === "plain" && !compact && "mt-4",
        )}
        onSubmit={(event) => {
          event.preventDefault();
          void todoState.handleCreate();
        }}
      >
        <FormControls.Input
          aria-label={copy.quickAdd.placeholder}
          className="col-span-full h-12 min-w-0 rounded-record-card border border-border bg-surface-interactive px-4 text-sm text-content-strong outline-none transition placeholder:text-content-subtle focus:border-ring focus:ring-4 focus:ring-ring/30 md:col-span-1"
          data-testid="home-todo-title-input"
          onChange={(event) => todoState.updateQuickDraftField("title", event.target.value)}
          placeholder={copy.quickAdd.placeholder}
          type="text"
          value={todoState.quickDraft.title}
        />

        <div className="min-w-0">
          <DatePicker
            aria-label={copy.quickAdd.dueDateLabel}
            onValueChange={(value) => todoState.updateQuickDraftField("dueDate", value)}
            value={todoState.quickDraft.dueDate}
          />
        </div>

        <DesignButton
          aria-label={
            todoState.quickDraft.isImportant
              ? copy.actions.unmarkImportant
              : copy.actions.markImportant
          }
          aria-pressed={todoState.quickDraft.isImportant}
          className={cn(
            "flex size-12 items-center justify-center rounded-record-card border text-content-muted transition",
            todoState.quickDraft.isImportant
              ? "border-border-subtle bg-surface-inset text-content-muted"
              : "border-border bg-surface-interactive hover:bg-surface-inset",
          )}
          data-testid="home-todo-quick-important"
          onClick={() =>
            todoState.updateQuickDraftField("isImportant", !todoState.quickDraft.isImportant)
          }
          title={
            todoState.quickDraft.isImportant
              ? copy.actions.unmarkImportant
              : copy.actions.markImportant
          }
          type="button"
        >
          <Star className={cn("size-4", todoState.quickDraft.isImportant ? "fill-current" : "")} />
        </DesignButton>

        <Button
          variant="primary"
          size="default"
          data-testid="home-todo-add-button"
          disabled={createPending}
          type="submit"
        >
          {createPending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {copy.actions.add}
        </Button>
      </form>

      <div className={cn("flex flex-wrap gap-2", compact ? "mt-2" : "mt-5")} role="tablist">
        {homeTodoFilterValues.map((filterValue) => (
          <TodoFilterButton
            active={todoState.filter === filterValue}
            count={todoState.counts[filterValue]}
            filter={filterValue}
            key={filterValue}
            label={copy.filters[filterValue](todoState.counts[filterValue])}
            onClick={() => todoState.setFilter(filterValue)}
          />
        ))}
      </div>

      {todoState.pageFeedback ? (
        <div className={compact ? "mt-3" : "mt-5"}>
          <FeedbackNotice tone={todoState.pageFeedback.tone}>
            {todoState.pageFeedback.message}
          </FeedbackNotice>
        </div>
      ) : null}

      <div
        className={cn(
          compact ? "mt-2" : "mt-6",
          frame === "plain" && "min-h-0 flex-1 overflow-y-auto pr-1",
        )}
      >
        <PresenceSwap
          presenceKey={
            todoState.filteredTodos.length === 0
              ? `empty:${todoState.filter}`
              : `list:${todoState.filter}`
          }
        >
          {todoState.filteredTodos.length === 0 ? (
            compact ? (
              <div className="flex min-h-16 items-center gap-3 rounded-surface-panel border border-dashed border-border bg-surface-panel p-3 text-left">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-info-soft text-status-info">
                  <ListTodo className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-content-strong">{emptyCopy.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-content-muted">
                    {emptyCopy.description}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState
                description={emptyCopy.description}
                icon={<ListTodo className="size-6" />}
                title={emptyCopy.title}
              />
            )
          ) : (
            <MotionList className="space-y-3">
              {todoState.filteredTodos.map((todo, index) => (
                <MotionListItem index={index} key={todo.id}>
                  <TodoItem
                    copy={copy}
                    locale={locale}
                    onDelete={() => void todoState.handleDelete(todo)}
                    onEdit={() => todoState.openEditDialog(todo)}
                    onToggleComplete={() => todoState.handleToggleComplete(todo)}
                    onToggleImportant={() => todoState.handleToggleImportant(todo)}
                    pendingAction={todoState.pendingAction}
                    todo={todo}
                  />
                </MotionListItem>
              ))}
            </MotionList>
          )}
        </PresenceSwap>
      </div>

      <HomeTodoDialog
        copy={copy}
        feedback={todoState.dialogFeedback}
        formState={todoState.formState}
        onOpenChange={todoState.handleDialogOpenChange}
        onSubmit={() => void todoState.handleSubmitEdit()}
        onUpdateField={todoState.updateFormField}
        open={todoState.dialogOpen}
        pending={todoState.pendingAction === "edit"}
      />
      <HomeTodoDeleteDialog
        copy={copy}
        onConfirm={() => void todoState.handleConfirmDelete()}
        onOpenChange={todoState.handleDeleteDialogOpenChange}
        open={todoState.deleteTarget !== null}
        pending={
          todoState.deleteTarget
            ? todoState.pendingAction === `delete:${todoState.deleteTarget.id}`
            : false
        }
        todo={todoState.deleteTarget}
      />
    </section>
  );
}
