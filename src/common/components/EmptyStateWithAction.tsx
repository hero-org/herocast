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
      <h3 className="mt-2 text-sm font-semibold text-gray-100">{title}</h3>
      <p className="mt-1 text-sm text-gray-300">{description}</p>
      {!hideButton && <div className="mt-6">
        <button
          type="button"
          onClick={() => onClick()}
          className="inline-flex items-center rounded-sm bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
        >
          {/* {icon && <icon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />} */}
          {submitText}
        </button>
      </div>}
    </div>
  )
}
