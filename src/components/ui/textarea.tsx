import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
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
            "flex min-h-[100px] w-full rounded-luxury bg-pearl/60 px-4 py-3 text-sm text-charcoal transition-colors duration-200 ease-out caret-secondary",
            "placeholder:text-charcoal-lighter/50",
            "hover:bg-pearl",
            "focus:bg-white focus:outline-none focus:ring-0",
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
