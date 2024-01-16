import React from "react";
import { AccountObjectType, useAccountStore } from "../../../../src/stores/useAccountStore";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import EmptyStateWithAction from "../../../../src/common/components/EmptyStateWithAction";
import { classNames } from "../../../../src/common/helpers/css";
import isEmpty from "lodash.isempty";
import ChannelsOverview from "./ChannelsOverview";
import { SidebarHeader } from "./SidebarHeader";
import * as Tooltip from '@radix-ui/react-tooltip';
import HotkeyTooltipWrapper from "../HotkeyTooltipWrapper";
import { useRouter } from 'next/router';

type AccountsRightSidebarProps = {
  showChannels?: boolean;
}

const AccountsRightSidebar = ({ showChannels }: AccountsRightSidebarProps) => {
    const router = useRouter()

  const {
    accounts,
    selectedAccountIdx,
    setCurrentAccountIdx
  } = useAccountStore();

  const renderEmptyState = () => (
    <div className="ml-6">
      <EmptyStateWithAction
        title="Connect Farcaster accounts"
        description="Get started with herocast"
        onClick={() => router.push('/accounts')}
        submitText="Connect account"
        icon={UserPlusIcon}
      />
    </div>
  )

  const renderStatus = (status: string) => {
    switch (status) {
      case "active":
        return <></>
      case "pre-migration":
        return <span className={classNames("flex-none text-sm text-yellow-300/80")}>
          pre-migration account
        </span>
      default:
        return <span className={classNames("underline flex-none text-sm text-gray-400")}>
          {status}
        </span>
    }
  }

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
                <h3 className={classNames(
                  idx === selectedAccountIdx ? "text-gray-100" : "text-gray-400",
                  "flex-auto truncate text-sm font-semibold leading-6")}>{item.name || 'New Account'}</h3>
                {renderStatus(item.status)}
                {item.platformAccountId && item.status === 'active' && (
                  <p className="truncate text-sm text-gray-500">
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

  return <aside className="min-h-full bg-gray-800 lg:fixed lg:bottom-0 lg:right-0 lg:top-16 lg:w-64 lg:border-l lg:border-white/5">
    <div className="lg:border-t lg:border-white/5">
      <SidebarHeader title="Accounts" />
      {isEmpty(accounts) ? renderEmptyState() : renderAccounts()}
      {showChannels && renderChannels()}
    </div>
  </aside>
}

export default AccountsRightSidebar;
