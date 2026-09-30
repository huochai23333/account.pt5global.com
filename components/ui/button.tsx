"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & {
  loading?: boolean;
};

function Button({
  className,
  variant = "primary",
  size = "default",
  wrap = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      // 等待中的按钮保留原文案供读屏器识别，同时阻止重复提交。
      aria-busy={loading || undefined}
      data-slot="button"
      data-size={size}
      data-variant={variant}
      data-wrap={wrap ? "true" : "false"}
      className={cn(buttonVariants({ variant, size, wrap, className }), loading && "[&>svg:nth-of-type(n+2)]:hidden")}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </ButtonPrimitive>
  );
}

/**
 * 卡片、表格文字入口等大面积点击目标不应继承普通按钮的固定高度和不换行规则。
 * 它仍保留统一的键盘焦点与禁用反馈，业务组件只负责卡片自身布局。
 */
function InteractiveButton({ className, ...props }: ButtonPrimitive.Props) {
  return (
    <ButtonPrimitive
      data-slot="interactive-button"
      className={cn(
        "min-w-0 whitespace-normal outline-none transition focus-visible:ring-4 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Button, InteractiveButton };
