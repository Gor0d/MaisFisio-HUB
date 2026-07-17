import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn("flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50", className)}
      {...props}
    />
  );
}
