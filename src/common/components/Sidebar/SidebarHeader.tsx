import React from 'react';

export const SidebarHeader = ({ title, actionTitle, onClick }: { title: string, actionTitle?: string, onClick?: () => void }) => {
  return (<div className="bg-muted/50 flex items-center justify-between border-l border-muted/10 px-4 py-3 sm:px-4 sm:py-3">
    <h1 className="text-base font-normal leading-7 text-primary">{title}</h1>
    {actionTitle && (
      <div onClick={() => onClick && onClick()} className="cursor-pointer text-sm font-semibold leading-6 text-foreground/80">
        {actionTitle}
      </div>
    )}
  </div>);
}
