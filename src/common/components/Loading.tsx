import clsx from "clsx";
import React from "react";

interface LoadingProps {
  className?: string;
  isInline?: boolean;
  loadingMessage?: string;
  displayEllipses?: boolean;
}

export const Loading = ({ 
  className, 
  isInline = false, 
  loadingMessage = "Loading",
  displayEllipses = true, 
}: LoadingProps) => (
  isInline 
  ? (
<span className={clsx(className, "my-4 font-semibold text-foreground")}>
    {loadingMessage}{displayEllipses && (<span className="animate-pulse">...</span>)}
  </span>
  )

  :(<p className={clsx(className, "my-4 font-semibold text-foreground")}>
    {loadingMessage}{displayEllipses && (<span className="animate-pulse">...</span>)}
  </p>)
);
