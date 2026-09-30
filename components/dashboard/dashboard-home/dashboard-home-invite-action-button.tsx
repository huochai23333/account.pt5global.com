import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 邀请码和邀请链接共用按钮外观，等待状态只属于当前被点击的一项。 */
export function InviteActionButton({
  icon,
  iconOnly,
  label,
  loading,
  miniLabel,
  onClick,
  testId,
}: {
  icon: ReactNode;
  iconOnly: boolean;
  label: string;
  loading: boolean;
  miniLabel?: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <Button
      className={cn("justify-start", iconOnly && "justify-center")}
      data-testid={testId}
      loading={loading}
      onClick={onClick}
      title={label}
      type="button"
      size="default"
      variant="outline"
      wrap
    >
      {iconOnly && miniLabel ? (
        <span aria-hidden="true" className="text-xs font-bold leading-none">
          {miniLabel}
        </span>
      ) : (
        icon
      )}
      <span className={cn("min-w-0 whitespace-normal break-words text-left leading-5", iconOnly && "sr-only")}>
        {label}
      </span>
    </Button>
  );
}
