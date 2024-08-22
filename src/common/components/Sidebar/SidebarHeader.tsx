import React from "react";

export const SidebarHeader = ({
  title,
  actionTitle,
  onClick,
}: {
  title: string | JSX.Element;
  actionTitle?: string;
  onClick?: () => void;
}) => {
  return (
    <div className="flex items-center justify-between border-l border-muted/10 px-4 py-3 sm:px-4 sm:py-3">
      <h3 className="text-md font-semibold leading-7 tracking-tight text-primary">{title}</h3>
      {actionTitle && (
        <div
          onClick={() => onClick && onClick()}
          className="cursor-pointer text-sm font-semibold leading-6 text-foreground/80"
        >
          {actionTitle}
        </div>
      )}
    </div>
  );
};
