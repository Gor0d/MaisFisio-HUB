import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn("min-h-24 w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15", className)} {...props} />;
}
