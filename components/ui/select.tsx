"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import type { VariantProps } from "class-variance-authority";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useRef, useState, type AriaAttributes, type ReactNode } from "react";

import { controlVariants } from "@/components/ui/form-controls";
import {
  useFormFieldControlAttributes,
  useFormFieldControlDensity,
  useFormFieldRequired,
} from "@/components/ui/form-field-context";
import { cn } from "@/lib/utils";

export type SelectOption<Value extends string = string> = Readonly<{
  disabled?: boolean;
  label: ReactNode;
  value: Value;
}>;

export type SelectProps<Value extends string = string> = {
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  "aria-required"?: AriaAttributes["aria-required"];
  "aria-label"?: string;
  "aria-labelledby"?: string;
  autoComplete?: string;
  className?: string;
  controlSize?: VariantProps<typeof controlVariants>["controlSize"];
  defaultValue?: Value | null;
  disabled?: boolean;
  id?: string;
  name?: string;
  onValueChange?: (value: Value) => void;
  options: readonly SelectOption<Value>[];
  placeholder?: ReactNode;
  readOnly?: boolean;
  required?: boolean;
  value?: Value | null;
};

/**
 * 全站唯一的单选下拉控件。
 *
 * 浏览器原生 select 的输入框可以被 CSS 美化，但展开后的菜单由操作系统绘制，
 * 因此圆角、颜色和选中态无法与工作台保持一致。这里使用 Base UI 负责键盘导航、
 * 触摸选择、焦点恢复和表单隐藏输入，业务组件只需要提供“值 + 文案”。
 */
export function Select<Value extends string = string>({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  autoComplete,
  className,
  controlSize,
  defaultValue,
  disabled = false,
  id,
  name,
  onValueChange,
  options,
  placeholder,
  readOnly = false,
  required,
  value,
}: SelectProps<Value>) {
  const density = useFormFieldControlDensity();
  // 未显式指定尺寸时跟随字段密度，普通表单仍保持 default，筛选区才使用 compact。
  const resolvedControlSize = controlSize ?? (density === "filter" ? "compact" : "default");
  const resolvedRequired = useFormFieldRequired(required);
  const fieldAttributes = useFormFieldControlAttributes({
    ariaDescribedBy,
    ariaInvalid,
    ariaRequired,
    id,
  });
  const firstEnabledValue = options.find((option) => !option.disabled)?.value;
  const resolvedDefaultValue =
    value === undefined
      ? defaultValue === undefined
        ? (firstEnabledValue ?? null)
        : defaultValue
      : undefined;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef(false);

  return (
    <div className={cn("min-w-0 w-full", className)} data-slot="select-root">
      <SelectPrimitive.Root
        autoComplete={autoComplete}
        defaultValue={resolvedDefaultValue}
        disabled={disabled || options.length === 0}
        items={options}
        name={name}
        onOpenChange={(nextOpen, details) => {
          if (!nextOpen && details.reason === "escape-key") {
            restoreFocusRef.current = true;
          }
          setOpen(nextOpen);
        }}
        onOpenChangeComplete={(nextOpen) => {
          if (!nextOpen && restoreFocusRef.current) {
            restoreFocusRef.current = false;
            triggerRef.current?.focus();
          }
        }}
        onValueChange={(nextValue) => {
          // 单选菜单没有清空手势；null 只表示尚未选择，因此不伪造业务值。
          if (nextValue !== null) onValueChange?.(nextValue as Value);
        }}
        readOnly={readOnly}
        required={resolvedRequired}
        open={open}
        value={value}
      >
        <SelectPrimitive.Trigger
          {...fieldAttributes}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            controlVariants({ controlSize: resolvedControlSize, density }),
            "group/select flex cursor-pointer items-center justify-between gap-3 text-left",
            "data-popup-open:border-ring data-popup-open:ring-4 data-popup-open:ring-ring",
            resolvedControlSize === "compact" && "h-11 sm:h-10",
          )}
          data-control-size={resolvedControlSize}
          data-slot="select"
          ref={triggerRef}
          type="button"
        >
          <SelectPrimitive.Value className="min-w-0 flex-1 truncate" placeholder={placeholder} />
          <SelectPrimitive.Icon className="shrink-0 text-content-muted transition-transform data-popup-open:rotate-180">
            <ChevronDown aria-hidden="true" className="size-4" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner
            align="start"
            alignItemWithTrigger={false}
            className="z-[70] max-w-[calc(100vw-1.5rem)] outline-none"
            sideOffset={8}
          >
            <SelectPrimitive.Popup
              className="min-w-[var(--anchor-width)] max-w-[min(32rem,calc(100vw-1.5rem))] overflow-hidden rounded-[18px] border border-border-subtle bg-surface-overlay text-popover-foreground shadow-[var(--surface-shadow-floating)] outline-none backdrop-blur-2xl backdrop-saturate-150"
              data-slot="select-popup"
              onKeyDownCapture={(event) => {
                if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) {
                  return;
                }

                // Base UI 的列表刚挂载时，DOM 文本索引可能晚于第一次键盘输入。
                // 对纯文字标签先把焦点移到首字母匹配项，随后 Enter 仍由 Base UI 正常确认。
                const searchKey = event.key.toLocaleLowerCase();
                const matchedOption = options.find(
                  (option) =>
                    !option.disabled &&
                    typeof option.label === "string" &&
                    option.label.trim().toLocaleLowerCase().startsWith(searchKey),
                );
                if (!matchedOption) return;

                const matchedElement = Array.from(
                  event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'),
                ).find((element) => element.dataset.value === matchedOption.value);
                if (!matchedElement) return;

                event.preventDefault();
                event.stopPropagation();
                matchedElement.focus();
              }}
            >
              <SelectPrimitive.ScrollUpArrow className="flex h-8 items-center justify-center border-b border-border-subtle bg-surface-overlay text-content-muted">
                <ChevronUp aria-hidden="true" className="size-4" />
              </SelectPrimitive.ScrollUpArrow>
              <SelectPrimitive.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain p-2">
                {options.map((option) => (
                  <SelectPrimitive.Item
                    className={cn(
                      // 设为 45px 是为了抵消浏览器在缩放和动画合成时的亚像素取整，最终触控区域仍不会低于 44px。
                      "relative flex min-h-[45px] cursor-pointer items-center rounded-[12px] px-3 py-2.5 pr-10 text-sm leading-6 text-content-strong outline-none select-none",
                      "data-highlighted:bg-surface-inset data-selected:bg-surface-brand-soft data-selected:font-semibold data-selected:text-primary",
                      "data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-45",
                    )}
                    data-value={option.value}
                    disabled={option.disabled}
                    key={option.value}
                    // 显式提供纯文字标签，让 Base UI 在浮层刚挂载时也能立即执行首字母检索；
                    // 不能只依赖 ItemText 的 DOM 测量，因为快速键盘输入可能早于该测量完成。
                    label={typeof option.label === "string" ? option.label : String(option.label)}
                    value={option.value}
                  >
                    <SelectPrimitive.ItemText className="min-w-0 break-words [overflow-wrap:anywhere]">
                      {option.label}
                    </SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex size-5 items-center justify-center text-primary">
                      <Check aria-hidden="true" className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.List>
              <SelectPrimitive.ScrollDownArrow className="flex h-8 items-center justify-center border-t border-border-subtle bg-surface-overlay text-content-muted">
                <ChevronDown aria-hidden="true" className="size-4" />
              </SelectPrimitive.ScrollDownArrow>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
