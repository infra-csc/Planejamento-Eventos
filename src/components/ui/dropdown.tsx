"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";

export const Dropdown = DM.Root;
export const DropdownTrigger = DM.Trigger;

export function DropdownContent({ children, align = "end", className }: { children: React.ReactNode; align?: "start" | "end"; className?: string }) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={6} className={cn("z-50 min-w-48 rounded-md border border-line bg-surface p-1 shadow-md text-sm", className)}>
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
        "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-1.5 outline-none data-[highlighted]:bg-black/5 data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
        danger ? "text-danger" : "text-ink",
        className,
      )}
    >
      {children}
    </DM.Item>
  );
}

export function DropdownSeparator() {
  return <DM.Separator className="my-1 h-px bg-line" />;
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <DM.Label className="px-2.5 py-1 text-xs text-ink-muted">{children}</DM.Label>;
}
