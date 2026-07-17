import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn("h-11 w-full appearance-none rounded-xl border border-input bg-background px-3.5 pr-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
