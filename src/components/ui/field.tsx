import { Children, cloneElement, forwardRef, isValidElement, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icone } from "./icons";

/*
 * Borda line-control: 3:1 sobre branco (WCAG 1.4.11). Foco: borda da marca + 1 px de anel da marca (2 px no total).
 * Só a troca de cor da borda de 1 px dava 2,5:1 entre os estados e o teclado não via o foco (auditoria 28/10 nº 135).
 */
export const FOCO_CAMPO = "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const base = `w-full rounded-controle border border-line-control bg-surface px-3 text-corpo text-ink transition-[color,border-color,box-shadow] duration-150 placeholder:text-meta hover:border-ink-3 ${FOCO_CAMPO} disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted read-only:bg-subtle aria-[invalid=true]:border-danger-input`;

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(base, "h-[34px] max-md:h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-[76px] resize-y py-2.5 leading-normal", className)} {...rest} />;
});

// Lista suspensa estilizada (Radix) — mesma API em todo o app.
export { Select } from "./select";

export function Label({ htmlFor, children, className, optional, obrigatorio }: { htmlFor?: string; children: React.ReactNode; className?: string; optional?: boolean; obrigatorio?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-[5px] block text-pequeno text-ink-2", className)}>
      {children}
      {obrigatorio && (
        <span className="text-danger" aria-hidden>
          {" "}
          *
        </span>
      )}
      {optional && <span className="text-meta"> (opcional)</span>}
    </label>
  );
}

type PropsAria = { "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false"; "aria-required"?: boolean };

/**
 * Rótulo + campo + mensagem. Com `htmlFor`, liga a mensagem (erro ou dica) ao campo por
 * `aria-describedby` e marca `aria-invalid`/`aria-required`: o leitor de tela anuncia o motivo do erro.
 */
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
  // Erro e dica juntos: antes o erro tomava o lugar da dica e quem usa leitor de tela perdia o formato pedido
  // (auditoria 28/10 nº 63). O erro vem primeiro na descrição.
  const idErro = htmlFor && error ? `${htmlFor}-erro` : undefined;
  const idDica = htmlFor && hint ? `${htmlFor}-dica` : undefined;
  const unico = Children.count(children) === 1 && isValidElement<PropsAria>(children) ? children : null;
  const campo =
    unico && htmlFor
      ? cloneElement(unico, {
          "aria-describedby": [unico.props["aria-describedby"], idErro, idDica].filter(Boolean).join(" ") || undefined,
          ...(error ? { "aria-invalid": true } : {}),
          ...(obrigatorio ? { "aria-required": true } : {}),
        })
      : children;
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <Label htmlFor={htmlFor} optional={optional} obrigatorio={obrigatorio}>
          {label}
        </Label>
      )}
      {campo}
      {error && (
        <span id={idErro} className="mt-[5px] flex items-start gap-1 text-pequeno text-danger">
          <Icone nome="erro" className="mt-px size-4" />
          {error}
        </span>
      )}
      {hint && (
        <p id={idDica} className={cn("text-pequeno text-muted", error ? "mt-1" : "mt-1.5")}>
          {hint}
        </p>
      )}
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
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-pequeno text-ink-2 max-md:min-h-10 max-md:py-2">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="mt-[2px] size-4 shrink-0 cursor-pointer accent-accent"
      />
      <span>
        {label}
        {description && <span className="block text-pequeno text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-controle border border-danger-border bg-danger-bg px-4 py-3 text-corpo text-danger">
      <Icone nome="erro" className="mt-0.5" />
      <span className="min-w-0">{message}</span>
    </div>
  );
}
