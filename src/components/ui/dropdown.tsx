"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";

export const Dropdown = DM.Root;
export const DropdownTrigger = DM.Trigger;

export function DropdownContent({ children, align = "end", className }: { children: React.ReactNode; align?: "start" | "end"; className?: string }) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={6} className={cn("z-50 min-w-48 animate-fade-up-rapido rounded-cartao border border-line-strong bg-surface p-1 text-corpo shadow-popover", className)}>
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function DropdownItem({ children, onSelect, danger, disabled, className }: { children: React.ReactNode; onSelect?: () => void; danger?: boolean; disabled?: boolean; className?: string }) {
  return (
    <DM.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-controle px-2.5 py-1.5 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent-bg data-[disabled]:opacity-50",
        danger ? "text-danger" : "text-ink",
        className,
      )}
    >
      {children}
    </DM.Item>
  );
}

export function DropdownSeparator() {
  return <DM.Separator className="my-1 h-px bg-line-soft" />;
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <DM.Label className="px-2.5 py-1 text-rotulo text-muted">{children}</DM.Label>;
}
