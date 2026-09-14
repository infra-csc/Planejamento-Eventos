import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const base =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-[13.5px] text-ink placeholder:text-meta focus:border-accent focus:outline-none disabled:bg-subtle disabled:text-muted read-only:bg-subtle aria-[invalid=true]:border-danger-input";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(base, "h-[34px]", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-[76px] resize-y py-2.5 leading-[1.5]", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cn(base, "h-[34px] px-2.5", className)} {...rest} />;
});

export function Label({ htmlFor, children, className, optional, obrigatorio }: { htmlFor?: string; children: React.ReactNode; className?: string; optional?: boolean; obrigatorio?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-[5px] block text-[12.5px] text-ink-2", className)}>
      {children}
      {obrigatorio && <span className="text-danger"> *</span>}
      {optional && <span className="text-meta"> (opcional)</span>}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  obrigatorio,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  obrigatorio?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <Label htmlFor={htmlFor} optional={optional} obrigatorio={obrigatorio}>
          {label}
        </Label>
      )}
      {children}
      {error ? <span className="mt-[5px] block text-[12px] text-danger">{error}</span> : hint ? <p className="mt-1.5 text-[12px] leading-[1.45] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({
  id,
  name,
  label,
  defaultChecked,
  checked,
  onChange,
  description,
}: {
  id: string;
  name?: string;
  label: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  description?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-[12.5px] text-ink-2">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="mt-[2px] size-[15px] shrink-0 accent-[#8e2740]"
      />
      <span>
        {label}
        {description && <span className="block text-[12px] text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-[9px] border border-danger-border bg-danger-bg px-4 py-3 text-[13px] text-danger">
      {message}
    </div>
  );
}
