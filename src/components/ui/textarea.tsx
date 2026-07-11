import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-charcoal-light">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            "flex min-h-[100px] w-full rounded-luxury bg-beige-dark/70 px-4 py-3 text-sm text-charcoal transition-colors duration-200 ease-out caret-secondary shadow-[inset_0_0_0_1px_rgba(58,36,56,0.06)]",
            "placeholder:text-charcoal-lighter/70",
            "hover:bg-beige-dark",
            "focus:bg-white focus:outline-none focus:ring-0 focus:shadow-[inset_0_0_0_1.5px_var(--color-secondary)]",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
            "resize-y",
            error && "text-destructive",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
