"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import {
  FormFieldContextProvider,
  useFormFieldControlAttributes,
  useFormFieldControlDensity,
  useFormFieldRequired,
  type FormFieldDensity,
} from "@/components/ui/form-field-context";

const controlVariants = cva(
  "w-full border bg-surface-interactive text-content-strong outline-none transition placeholder:text-content-subtle focus:border-ring focus:ring-4 focus:ring-ring disabled:cursor-not-allowed disabled:bg-surface-inset disabled:text-content-muted disabled:opacity-70 aria-invalid:border-status-danger aria-invalid:ring-status-danger/20",
  {
    variants: {
      controlSize: {
        compact: "h-control-compact rounded-control-compact px-3 text-xs",
        default: "h-control-default rounded-control-default px-3 text-sm sm:px-4",
        large: "h-control-large rounded-control-large px-4 text-[15px]",
      },
      density: {
        // 普通表单需要更明确的静止边界；筛选区一排控件较多，使用更轻的层级减少视觉噪音。
        default: "border-control-border",
        filter: "border-filter-control-border hover:border-filter-control-hover",
      },
    },
    defaultVariants: {
      controlSize: "default",
      density: "default",
    },
  },
);

/**
 * 字段容器统一生成输入框 id 和说明关联。
 * 输入组件会读取这里的上下文，因此业务页面不需要重复拼接 aria-describedby。
 */
export function Field({
  children,
  className,
  controlId,
  density = "default",
  error,
  hint,
  hintTone = "neutral",
  label,
  labelAction,
  labelHidden = false,
  required = false,
}: {
  children: ReactNode;
  className?: string;
  controlId?: string;
  density?: FormFieldDensity;
  error?: ReactNode;
  hint?: ReactNode;
  hintTone?: "neutral" | "success" | "warning";
  label: ReactNode;
  labelAction?: ReactNode;
  labelHidden?: boolean;
  required?: boolean;
}) {
  const generatedId = useId();
  const resolvedControlId = controlId ?? generatedId;
  const hintId = hint ? `${resolvedControlId}-hint` : undefined;
  const errorId = error ? `${resolvedControlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FormFieldContextProvider
      value={{
        controlId: resolvedControlId,
        describedBy,
        density,
        invalid: Boolean(error),
        required,
      }}
    >
      <div
        className={cn(
          "grid min-w-0",
          density === "default" ? "gap-2" : "gap-1.5 sm:gap-2",
          className,
        )}
        data-density={density}
        data-required={required ? "true" : "false"}
        data-slot="field"
      >
        <div
          className={cn(
            "flex items-center justify-between gap-4",
            density === "default" && "px-1",
            labelHidden && "sr-only",
          )}
          data-slot="field-heading"
        >
          <label
            className={cn(
              "font-semibold uppercase",
              density === "default"
                ? "font-label text-[11px] tracking-[0.18em] text-content-muted"
                : "text-[10px] tracking-[0.14em] text-content-subtle sm:text-[11px] sm:tracking-[0.16em]",
            )}
            data-slot="field-label"
            htmlFor={resolvedControlId}
          >
            {label}
            {required ? (
              <span aria-hidden="true" className="ml-1 text-status-danger">
                *
              </span>
            ) : null}
          </label>
          {labelAction}
        </div>
        {children}
        {hint ? (
          <p
            className={cn(
              "px-1 text-xs leading-5",
              hintTone === "neutral" && "text-content-muted",
              hintTone === "success" && "text-status-success",
              hintTone === "warning" && "text-status-warning",
            )}
            data-slot="field-hint"
            id={hintId}
          >
            {hint}
          </p>
        ) : null}
        {error ? (
          <p
            aria-live="polite"
            className="text-xs leading-5 text-status-danger"
            data-slot="field-error"
            id={errorId}
          >
            {error}
          </p>
        ) : null}
      </div>
    </FormFieldContextProvider>
  );
}

type ControlSizeProps = Pick<VariantProps<typeof controlVariants>, "controlSize">;

type InputProps = Omit<ComponentProps<"input">, "size"> & ControlSizeProps;

export function Input({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  className,
  controlSize,
  id,
  required,
  ...props
}: InputProps) {
  const density = useFormFieldControlDensity();
  // 筛选字段在桌面端优先使用 40px 紧凑控件；紧凑令牌在移动端仍会自动保持 44px 触控高度。
  const resolvedControlSize = controlSize ?? (density === "filter" ? "compact" : "default");
  const resolvedRequired = useFormFieldRequired(required);
  const fieldAttributes = useFormFieldControlAttributes({
    ariaDescribedBy,
    ariaInvalid,
    ariaRequired,
    id,
  });

  return (
    <input
      className={cn(controlVariants({ controlSize: resolvedControlSize, density }), className)}
      data-control-size={resolvedControlSize}
      data-slot="input"
      {...fieldAttributes}
      required={resolvedRequired}
      {...props}
    />
  );
}

type TextareaProps = ComponentProps<"textarea"> & ControlSizeProps;

export function Textarea({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  className,
  controlSize,
  id,
  required,
  ...props
}: TextareaProps) {
  const density = useFormFieldControlDensity();
  const resolvedRequired = useFormFieldRequired(required);
  const fieldAttributes = useFormFieldControlAttributes({
    ariaDescribedBy,
    ariaInvalid,
    ariaRequired,
    id,
  });

  return (
    <textarea
      className={cn(
        controlVariants({ controlSize, density }),
        "min-h-32 resize-y py-3 leading-7",
        className,
      )}
      data-control-size={controlSize ?? "default"}
      data-slot="textarea"
      {...fieldAttributes}
      required={resolvedRequired}
      {...props}
    />
  );
}

type ChoiceProps = Omit<ComponentProps<"input">, "size" | "type"> & {
  type: "checkbox" | "radio";
};

function Choice({ className, type, ...props }: ChoiceProps) {
  return (
    <input
      className={cn(
        "size-4 shrink-0 accent-primary outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      data-slot={type}
      type={type}
      {...props}
    />
  );
}

export function Checkbox(props: Omit<ChoiceProps, "type">) {
  return <Choice type="checkbox" {...props} />;
}

export function Radio(props: Omit<ChoiceProps, "type">) {
  return <Choice type="radio" {...props} />;
}

type ChoiceFieldProps = Omit<ChoiceProps, "type"> & {
  description?: ReactNode;
  label: ReactNode;
  rootClassName?: string;
  type?: "checkbox" | "radio" | "toggle";
};

/**
 * 复选和单选行必须把整行都作为可点击目标，同时保留原生控件的键盘行为。
 * 业务表单只传文字和选中状态，不再自行拼接 label、说明文字与面板材质。
 */
export function ChoiceField({
  className,
  description,
  id,
  label,
  rootClassName,
  type = "checkbox",
  ...props
}: ChoiceFieldProps) {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const Control = type === "radio" ? Radio : type === "toggle" ? Switch : Checkbox;

  return (
    <label
      className={cn(
        "flex min-h-button-default cursor-pointer items-start gap-3 rounded-record-card border border-border-subtle bg-surface-interactive px-4 py-3 text-sm transition hover:border-filter-control-hover focus-within:ring-4 focus-within:ring-ring",
        rootClassName,
      )}
      data-slot="choice-field"
      htmlFor={resolvedId}
    >
      <Control className={cn("mt-0.5", className)} id={resolvedId} {...props} />
      <span className="min-w-0">
        <span className="block font-semibold text-content-strong">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-5 text-content-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function Switch({ className, ...props }: Omit<ChoiceProps, "type">) {
  return (
    <input
      className={cn(
        "peer relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-muted outline-none transition before:absolute before:left-1 before:top-1 before:size-4 before:rounded-full before:bg-surface-interactive before:shadow-sm before:transition checked:bg-primary checked:before:translate-x-5 focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      data-slot="switch"
      role="switch"
      type="checkbox"
      {...props}
    />
  );
}

export { controlVariants };
