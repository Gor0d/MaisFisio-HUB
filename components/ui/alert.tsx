import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="alert" className={cn("rounded-xl border border-border bg-muted/60 p-4 text-sm", className)} {...props} />;
}
