import clsx from "clsx";
import React from "react";

export const Loading = ({ className }: { className?: string }) => (
  <p className={clsx(className, "my-4 font-semibold text-foreground")}>
    Loading<span className="animate-pulse">...</span>
  </p>
);
