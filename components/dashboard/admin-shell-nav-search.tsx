"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";

type AdminShellNavSearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
};

/** 搜索框独立于滚动菜单；清空后将焦点留在输入框，方便继续搜索。 */
export function AdminShellNavSearch({ query, onQueryChange }: AdminShellNavSearchProps) {
  const t = useTranslations("DashboardShell.navSearch");
  const inputRef = useRef<HTMLInputElement>(null);
  const clearSearch = () => {
    onQueryChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="mx-1 mb-3 flex shrink-0 items-center gap-1">
      <Field className="min-w-0 flex-1" label={t("label")} labelHidden>
        <Input
          autoComplete="off"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            // 输入法组合期间的 Esc 用于取消组词，不应同时清空整个搜索。
            if (event.key === "Escape" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              clearSearch();
            }
          }}
          placeholder={t("label")}
          ref={inputRef}
          role="searchbox"
          type="text"
          value={query}
        />
      </Field>
      <Button
        aria-label={t("clear")}
        disabled={!query}
        onClick={clearSearch}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
