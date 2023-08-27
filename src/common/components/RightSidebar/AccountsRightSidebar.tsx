import React from "react";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import EmptyStateWithAction from "@/common/components/EmptyStateWithAction";
import { classNames } from "@/common/helpers/css";
import isEmpty from "lodash.isempty";
import ChannelsOverview from "./ChannelsOverview";
import { SidebarHeader } from "./SidebarHeader";
import * as Tooltip from '@radix-ui/react-tooltip';
import HotkeyTooltipWrapper from "../HotkeyTooltipWrapper";

const AccountsRightSidebar = () => {
  const {
    toAccounts,
  } = useNavigationStore();
  const {
    accounts,
    selectedAccountIdx,
    setCurrentAccountIdx
  } = useAccountStore();

  const renderEmptyState = () => (
    <div className="ml-6">
      <EmptyStateWithAction
        title="No accounts"
        description="Add an account to get started"
        onClick={() => toAccounts()}
        submitText="Add account"
        icon={UserPlusIcon}
      />
    </div>
  )

  const renderAccounts = () => (
    <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
      <ul role="list" className="mx-4 divide-y divide-white/5">
        {accounts.map((item: AccountObjectType, idx: number) => (
          <li key={item.id} className="px-2 py-2 sm:px-3 lg:px-4">
            <HotkeyTooltipWrapper hotkey={`Ctrl + ${idx + 1}`} side="left">
              <div
                onClick={() => item.status === "active" && setCurrentAccountIdx(idx)}
                className="flex items-center gap-x-3 cursor-pointer"
              >
                {/* <img src={item.user.imageUrl} alt="" className="h-6 w-6 flex-none rounded-full bg-gray-800" /> */}
                <h3 className={classNames(
                  idx === selectedAccountIdx ? "text-gray-100" : "text-gray-400",
                  "flex-auto truncate text-sm font-semibold leading-6")}>{item.name}</h3>
                {item.status !== "active" && (
                  <span className={classNames("underline flex-none text-sm text-gray-400")}>
                    {item.status}
                  </span>)}
                {item.platformAccountId && (
                  <p className="mt-1 truncate text-sm text-gray-500">
                    fid {item.platformAccountId}
                  </p>
                )}
              </div>
            </HotkeyTooltipWrapper>
          </li>
        ))}
      </ul>
    </Tooltip.Provider >
  )

  const renderChannels = () => {
    return <div className="mt-4"><ChannelsOverview /></div>;
  }

  return <aside className="min-h-full bg-gray-800 lg:fixed lg:bottom-0 lg:right-0 lg:top-20 lg:w-80 lg:overflow-y-auto lg:border-l lg:border-white/5">
    <div className="lg:border-t lg:border-white/5">
      <SidebarHeader title="Accounts" />
      {isEmpty(accounts) ? renderEmptyState() : renderAccounts()}
      {renderChannels()}
    </div>
  </aside>
}

export default AccountsRightSidebar;
