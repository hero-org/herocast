export const SidebarHeader = ({ title, actionTitle, onClick }: { title: string, actionTitle?: string, onClick?: () => void }) => {
  return (<div className="bg-gray-600 flex items-center justify-between border-y border-white/5 px-4 py-2 sm:px-6 sm:py-4 lg:px-8">
    <h2 className="text-base font-semibold leading-7 text-white">{title}</h2>
    {actionTitle && (
      <div onClick={() => onClick()} className="cursor-pointer text-sm font-semibold leading-6 text-gray-300">
        {actionTitle}
      </div>
    )}
  </div>);
}
