import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { classNames } from "@/common/helpers/css";
import { ArrowLongRightIcon, ArrowRightIcon, CheckCircleIcon, CheckIcon } from "@heroicons/react/20/solid";
import findIndex from "lodash.findindex";

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    key: string;
    idx: number;
    title: string;
  }[];
  step: string;
  onClick: (string) => void;
}

export function SidebarNav({
  className,
  items,
  step,
  onClick,
  ...props
}: SidebarNavProps) {
  const currentStepIdx = findIndex(items, (item) => item.key === step);

  return (
    <nav
      className={classNames(
        "flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1",
        className!
      )}
      {...props}
    >
      {items.map((item, idx) => (
        <Button
          onClick={() => onClick(item.key)}
          key={item.key}
          variant="ghost"
          className={classNames(
            item.key === step
              ? "bg-muted hover:bg-muted"
              : "text-foreground/40 hover:bg-transparent hover:underline",
            "justify-start truncate"
          )}
        >
          {item.title}
          <div className="flex-shrink-0 ml-2">
            {item.idx < currentStepIdx ? (
              <CheckCircleIcon
                className="h-6 w-6 text-green-600"
                aria-hidden="true"
              />
            ) : (
              <ArrowRightIcon
                className="mx-1 h-4 w-4 text-foreground/40"
                aria-hidden="true"
              />
            )}
          </div>
        </Button>
      ))}
    </nav>
  );
}
