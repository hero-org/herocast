import React from 'react';

export const SidebarHeader = ({ title, actionTitle, onClick }: { title: string, actionTitle?: string, onClick?: () => void }) => {
  return (<div className="rounded-l-md bg-muted flex items-center justify-between border-l border-muted/5 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
    <h1 className="text-base font-semibold leading-7 text-primary">{title}</h1>
    {actionTitle && (
      <div onClick={() => onClick && onClick()} className="cursor-pointer text-sm font-semibold leading-6 text-foreground/80">
        {actionTitle}
      </div>
    )}
  </div>);
}
