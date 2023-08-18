import React from "react";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import EmptyStateWithAction from "@/common/components/EmptyStateWithAction";
import { classNames } from "@/common/helpers/css";
import isEmpty from "lodash.isempty";
import ChannelsOverview from "./ChannelsOverview";
import { SidebarHeader } from "./SidebarHeader";

// const EmptyStateWithAction = React.lazy(() =>
//   import('@/common/components/EmptyStateWithAction'),
// );


const AccountsRightSidebar = () => {
  const {
    toAccounts,
  } = useNavigationStore();
  const {
    accounts,
    selectedAccountIdx,
  } = useAccountStore();

  const renderEmptyState = () => (
    <EmptyStateWithAction
      title="No accounts"
      description="Add an account to get started"
      onSubmit={toAccounts}
      submitText="Add account"
      icon={UserPlusIcon}
    />
  )

  const renderAccounts = () => (
    <ul role="list" className="mx-4 divide-y divide-white/5">
      {accounts.map((item: AccountObjectType, idx: number) => (
        <li key={item.id} className="px-2 py-2 sm:px-3 lg:px-4">
          <div className="flex items-center gap-x-3">
            {/* <img src={item.user.imageUrl} alt="" className="h-6 w-6 flex-none rounded-full bg-gray-800" /> */}
            <h3 className={classNames(
              idx === selectedAccountIdx ? "text-gray-100" : "text-gray-400",
              "flex-auto truncate text-sm font-semibold leading-6")}>{item.name}</h3>
            {item.status !== "active" && (
              <span className={classNames("underline flex-none text-sm")}>
                {item.status}
              </span>)}
            {item.platformAccountId && (
              <p className="mt-1 truncate text-sm text-gray-500">
                fid {item.platformAccountId}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>)

  const renderChannels = () => {
    return <ChannelsOverview />;
  }

  return <aside className="lg:fixed lg:bottom-0 lg:right-0 lg:top-20 lg:w-80 lg:overflow-y-auto lg:border-l lg:border-white/5">
    <SidebarHeader title="Accounts" />
    {isEmpty(accounts) ? renderEmptyState() : renderAccounts()}
    {renderChannels()}
  </aside>
}

export default AccountsRightSidebar;
