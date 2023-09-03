import React from 'react';

export const SidebarHeader = ({ title, actionTitle, onClick }: { title: string, actionTitle?: string, onClick?: () => void }) => {
  return (<div className="mt-4 ml-4 mr-4 xl:mr-6 rounded-sm bg-gray-700 flex items-center justify-between border-l border-white/5 px-4 py-2 sm:px-6 sm:py-3 lg:px-8">
    <h1 className="text-base font-semibold leading-7 text-gray-100">{title}</h1>
    {actionTitle && (
      <div onClick={() => onClick && onClick()} className="cursor-pointer text-sm font-semibold leading-6 text-gray-300">
        {actionTitle}
      </div>
    )}
  </div>);
}
