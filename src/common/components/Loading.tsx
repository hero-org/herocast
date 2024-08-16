import clsx from "clsx";
import React from "react";

interface LoadingProps {
  className?: string;
  isInline?: boolean;
  loadingMessage?: string;
}

export const Loading = ({ className, isInline = false, loadingMessage = "Loading" }: LoadingProps) =>
  isInline ? (
    <span className={clsx(className, "my-4 whitespace-nowrap font-semibold text-foreground")}>
      {loadingMessage}
      <span className="animate-pulse">...</span>
    </span>
  ) : (
    <p className={clsx(className, "my-4 whitespace-nowrap font-semibold text-foreground")}>
      {loadingMessage}
      <span className="animate-pulse">...</span>
    </p>
  );
