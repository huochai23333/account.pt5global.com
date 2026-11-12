"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, InteractiveButton } from "@/components/ui/button";
import type {
  DocumentFolder,
  DocumentSelection,
  ExplorerLibrary,
} from "@/lib/document-library/model";
import { folderLabel } from "./folder-label";
import { folderSubject } from "./explorer-helpers";

/** 位置栏只处理历史记录、上一级和可见路径。列表动作和搜索留在工具栏。 */
export function ExplorerLocationBar({
  data,
  userId,
  navigate,
  refresh,
  busy,
}: {
  data: ExplorerLibrary;
  userId: string;
  navigate: (selection: DocumentSelection) => void;
  refresh: () => void;
  busy: boolean;
}) {
  const t = useTranslations("Documents");
  const folder = data.folders.find((f) => f.id === data.folderId);
  const archive = data.archives.find((a) => a.id === data.archiveId);
  const parents: DocumentFolder[] = [];
  let current = folder;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parent_id) parents.unshift(current);
    current = data.folders.find((f) => f.id === current?.parent_id);
  }
  const subject = folderSubject(data);
  const pathRef = useRef<HTMLElement>(null);
  // 长路径在自己的区域滚动，进入目录后显示末端；完整名称仍可读且各级均可点击。
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const scroll = () => {
      path.scrollLeft = path.scrollWidth;
    };
    scroll();
    const observer = new ResizeObserver(scroll);
    observer.observe(path);
    return () => observer.disconnect();
  }, [data.folderId]);
  // 根目录在界面上直接代表账户；上一级返回其分类，不再出现额外的资料目录层。
  function up() {
    if (folder?.parent_id) {
      const parent = data.folders.find((f) => f.id === folder.parent_id);
      navigate({
        ...subject,
        scope: parent?.parent_id
          ? "folder"
          : archive?.kind === "public"
            ? "public"
            : "archive",
        folder: parent?.parent_id ? parent.id : undefined,
      });
    } else
      navigate({
        scope:
          archive?.kind === "public" || archive?.user_id === userId
            ? "home"
            : archive?.kind === "customer"
              ? "customers"
              : "employees",
      });
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap">
      <Button
        size="icon"
        variant="outline"
        aria-label={t("explorer.back")}
        disabled={busy}
        onClick={() => window.history.back()}
      >
        <ArrowLeft aria-hidden className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        aria-label={t("explorer.forward")}
        disabled={busy}
        onClick={() => window.history.forward()}
      >
        <ArrowRight aria-hidden className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        aria-label={t("explorer.up")}
        disabled={busy || data.scope === "home"}
        onClick={up}
      >
        <ArrowUp aria-hidden className="size-4" />
      </Button>
      {/* 桌面路径从剩余宽度分配，长名称只在路径内滚动，避免把导航按钮挤成三行。 */}
      <nav
        ref={pathRef}
        aria-label={t("explorer.path")}
        className="order-last flex basis-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto text-sm lg:order-none lg:basis-0 lg:flex-1"
      >
        <InteractiveButton
          className="min-h-11 shrink-0 rounded px-2 text-primary"
          disabled={busy}
          onClick={() => navigate({ scope: "home" })}
        >
          {t("explorer.home")}
        </InteractiveButton>
        {(data.scope === "employees" || data.scope === "customers") && (
          <span>/ {t(`explorer.${data.scope}`)}</span>
        )}
        {(data.scope === "archive" ||
          data.scope === "folder" ||
          data.scope === "public") && (
          <>
            <span>/</span>
            <InteractiveButton
              title={archive?.name}
              className="min-h-11 max-w-48 shrink-0 truncate whitespace-nowrap rounded px-2 text-primary"
              disabled={busy}
              onClick={() =>
                navigate({
                  ...subject,
                  scope: archive?.kind === "public" ? "public" : "archive",
                })
              }
            >
              {archive?.kind === "public"
                ? t("explorer.publicDocuments")
                : archive?.user_id === userId
                  ? t("explorer.myDocuments")
                  : archive?.name}
            </InteractiveButton>
            {parents.map((f) => (
              <span
                key={f.id}
                className="inline-flex shrink-0 items-center gap-1"
              >
                <span>/</span>
                <InteractiveButton
                  title={folderLabel(f, t)}
                  className="min-h-11 max-w-48 truncate whitespace-nowrap rounded px-2 text-primary"
                  disabled={busy}
                  onClick={() =>
                    navigate({ ...subject, scope: "folder", folder: f.id })
                  }
                >
                  {folderLabel(f, t)}
                </InteractiveButton>
              </span>
            ))}
          </>
        )}
      </nav>
      <Button
        size="icon"
        aria-label={t("explorer.refresh")}
        variant="outline"
        disabled={busy}
        onClick={refresh}
      >
        <RefreshCw aria-hidden className="size-4" />
      </Button>
    </div>
  );
}
