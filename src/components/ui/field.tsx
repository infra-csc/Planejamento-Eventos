import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const controlBase =
  "w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-info focus:outline-none focus:ring-2 focus:ring-info/20 disabled:bg-surface-muted disabled:text-ink-muted aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(controlBase, "h-9", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(controlBase, "py-2 min-h-20 leading-snug", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cn(controlBase, "h-9 pr-8", className)} {...rest} />;
});

export function Label({ htmlFor, children, className, optional }: { htmlFor?: string; children: React.ReactNode; className?: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-[13px] font-medium text-ink-secondary mb-1.5", className)}>
      {children}
      {optional && <span className="ml-1 font-normal text-ink-faint">(opcional)</span>}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <Label htmlFor={htmlFor} optional={optional}>
          {label}
        </Label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ id, name, label, defaultChecked, checked, onChange, description }: { id: string; name?: string; label: string; defaultChecked?: boolean; checked?: boolean; onChange?: (v: boolean) => void; description?: string }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 cursor-pointer">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="mt-0.5 size-4 rounded border-line-strong accent-brand"
      />
      <span>
        <span className="text-sm text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {message}
    </div>
  );
}
