import { cn } from "@/lib/utils";
import { Button } from "./button";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
          <Icon className="h-8 w-8 text-secondary" />
        </div>
      )}
      <h3 className="font-heading text-lg font-semibold text-charcoal mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-charcoal-lighter max-w-sm mb-6">
          {description}
        </p>
      )}
      {actionLabel && (
        actionHref ? (
          <a href={actionHref}>
            <Button variant="primary">{actionLabel}</Button>
          </a>
        ) : (
          <Button variant="primary" onClick={onAction}>{actionLabel}</Button>
        )
      )}
    </div>
  );
}

export { EmptyState };
