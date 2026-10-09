import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { StatusTone } from "@/lib/domain/order-state";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 disabled:bg-brand-600/50",
  secondary: "bg-surface text-ink-900 border border-border-default hover:bg-canvas disabled:text-text-secondary",
  tertiary: "text-brand-600 hover:bg-brand-50 underline-offset-4 hover:underline",
  danger: "bg-danger text-white hover:brightness-95 disabled:opacity-50",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-[52px] px-6 text-base",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  fullWidth = false,
  extra = "",
): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors",
    "disabled:cursor-not-allowed",
    VARIANT[variant],
    SIZE[size],
    fullWidth ? "w-full" : "",
    extra,
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean }) {
  return <button type={type} className={buttonClass(variant, size, fullWidth, className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, fullWidth, className)}>
      {children}
    </Link>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: ReactNode;
}) {
  const styles = {
    info: "bg-info-bg border-brand-600/30 text-ink-900",
    success: "bg-success-bg border-success/30 text-ink-900",
    warning: "bg-warning-bg border-warning/40 text-ink-900",
    danger: "bg-danger-bg border-danger/40 text-ink-900",
  }[tone];
  const role = tone === "danger" ? "alert" : "status";
  return (
    <div role={role} className={`rounded-lg border p-4 ${styles}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1 text-sm" : "text-sm"}>{children}</div> : null}
    </div>
  );
}

const FIELD_INPUT =
  "h-11 w-full rounded-md border bg-surface px-3 text-[15px] text-ink-900 placeholder:text-text-secondary/80";

export function TextField({
  name,
  label,
  type = "text",
  defaultValue,
  error,
  help,
  required = false,
  autoComplete,
  inputMode,
  placeholder,
  maxLength,
  onChange,
  onBlur,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  error?: string;
  help?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "search";
  placeholder?: string;
  maxLength?: number;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}) {
  const id = `f-${name}`;
  const describedBy = [error ? `${id}-err` : null, help ? `${id}-help` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        onBlur={onBlur}
        className={`${FIELD_INPUT} ${error ? "border-danger" : "border-border-default"}`}
      />
      {help && !error ? (
        <p id={`${id}-help`} className="text-sm text-text-secondary">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  error,
  required = false,
  onChange,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string;
  error?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={`${FIELD_INPUT} ${error ? "border-danger" : "border-border-default"}`}
      >
        <option value="">Pilih…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${id}-err`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const TONE_CLASS: Record<StatusTone, string> = {
  warning: "bg-warning-bg text-warning",
  info: "bg-info-bg text-info",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-neutral-bg text-text-secondary",
};

/** Status selalu memakai teks, tidak hanya warna (design doc 15.1). */
export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}>
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border-default bg-surface p-6 sm:p-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="max-w-prose text-text-secondary">{description}</p>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border-default bg-surface p-5 shadow-1 ${className}`}>{children}</div>;
}
