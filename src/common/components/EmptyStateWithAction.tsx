import { Button } from "@/components/ui/button";
import React from "react";

type EmptyStateWithActionProps = {
  title: string,
  description: string,
  hideButton?: boolean,
  icon?: React.ComponentType<{ className: string }>,
  submitText: string,
  onClick: () => void
}

export default function EmptyStateWithAction({ title, description, icon, hideButton, submitText, onClick }: EmptyStateWithActionProps) {
  return (
    <div className="py-4 text-left">
      <h3 className="mt-2 text-sm font-semibold text-foreground/80">{title}</h3>
      <p className="mt-1 text-sm text-foreground/80">{description}</p>
      {!hideButton && <div className="mt-6">
        <Button
          variant="outline"
          onClick={() => onClick()}
        >
          {/* {icon && <icon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />} */}
          {submitText}
        </Button>
      </div>}
    </div>
  )
}
