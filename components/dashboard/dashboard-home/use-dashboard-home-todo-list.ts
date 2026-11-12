"use client";

import { useCallback, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getUserTodos,
  sortUserTodos,
  toUserTodoErrorMessage,
  type UserTodoErrorCopy,
  type UserTodoItemRow,
} from "@/lib/user-todos";
import { useWorkspaceSyncEffect } from "../workspace-session-provider";
import {
  filterHomeTodos,
  getHomeTodoCounts,
  type HomeTodoFilter,
} from "./dashboard-home-todo-display";

/** 维护已读/已确认的本人待办列表；输入草稿和提交动作留给 use-dashboard-home-todos。 */
export function useDashboardHomeTodoList({
  initialTodos,
  supabase,
  errorCopy,
  onReadError,
}: {
  initialTodos: UserTodoItemRow[];
  supabase: SupabaseClient | null;
  errorCopy: UserTodoErrorCopy;
  onReadError: (feedback: { message: string; tone: "error" }) => void;
}) {
  const [todos, setTodos] = useState(() => sortUserTodos(initialTodos));
  const [filter, setFilter] = useState<HomeTodoFilter>("active");
  const refreshTodos = useCallback(
    async ({ isMounted }: { isMounted: () => boolean }) => {
      if (!supabase) return;
      try {
        const nextTodos = await getUserTodos(supabase);
        // 工作台恢复事件可能已过期；不把上一轮读取覆盖到当前页面。
        if (isMounted()) setTodos(nextTodos);
      } catch (error) {
        if (isMounted())
          onReadError({
            message: toUserTodoErrorMessage(error, errorCopy),
            tone: "error",
          });
      }
    },
    [errorCopy, onReadError, supabase],
  );
  useWorkspaceSyncEffect(refreshTodos);

  const counts = useMemo(() => getHomeTodoCounts(todos), [todos]);
  const filteredTodos = useMemo(
    () => filterHomeTodos(todos, filter),
    [filter, todos],
  );

  // 这些函数只应用服务已经确认的记录；本身不会发送或重复提交任何写入。
  const addTodo = useCallback((todo: UserTodoItemRow) => {
    setTodos((current) => sortUserTodos([todo, ...current]));
  }, []);
  const applyTodo = useCallback((updatedTodo: UserTodoItemRow) => {
    setTodos((current) =>
      sortUserTodos(
        current.map((todo) =>
          todo.id === updatedTodo.id ? updatedTodo : todo,
        ),
      ),
    );
  }, []);
  const removeTodo = useCallback((id: string) => {
    setTodos((current) => current.filter((todo) => todo.id !== id));
  }, []);

  return {
    addTodo,
    applyTodo,
    counts,
    filter,
    filteredTodos,
    removeTodo,
    setFilter,
    todos,
  };
}
