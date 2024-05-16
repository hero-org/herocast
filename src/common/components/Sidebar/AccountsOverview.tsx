import React from "react";
import {
  AccountObjectType,
  PENDING_ACCOUNT_NAME_PLACEHOLDER,
  useAccountStore,
} from "@/stores/useAccountStore";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { classNames } from "@/common/helpers/css";
import { SidebarHeader } from "./SidebarHeader";
import * as Tooltip from "@radix-ui/react-tooltip";
import HotkeyTooltipWrapper from "../HotkeyTooltipWrapper";
import { useRouter } from "next/router";
import {
  AccountPlatformType,
  AccountStatusType,
} from "@/common/constants/accounts";

const AccountsOverview = () => {
  const router = useRouter();

  const { hydratedAt, accounts, selectedAccountIdx, setCurrentAccountIdx } =
    useAccountStore();

  const selectedAccount = accounts[selectedAccountIdx];

  const renderStatus = (status: string) => {
    switch (status) {
      case "active":
        return <></>;
      case "pre-migration":
        return (
          <span className={classNames("flex-none text-sm text-yellow-300/80")}>
            pre-migration account
          </span>
        );
      default:
        return (
          <span
            className={classNames(
              "underline flex-none text-sm text-foreground/70"
            )}
          >
            {status}
          </span>
        );
    }
  };

  const renderAccountPlatformIndicator = (platform: AccountPlatformType) => {
    switch (platform) {
      case AccountPlatformType.farcaster_hats_protocol:
        return (
          <p className="truncate text-md text-foreground grayscale group-hover:grayscale-0">
            🧢
          </p>
        );
      case AccountPlatformType.farcaster_local_readonly:
        return (
          <p className="truncate text-md text-foreground grayscale group-hover:grayscale-0">
            <ArrowDownTrayIcon className="w-4 h-4" />
          </p>
        );
      default:
        return null;
    }
  };

  const onClickAccount = (
    idx: number,
    isActive: boolean,
    isReadOnly: boolean
  ) => {
    if (isActive) {
      setCurrentAccountIdx(idx);
    } else if (isReadOnly) {
      router.push(`/login?signupOnly=true`);
    } else {
      router.push(`/accounts`);
    }
  };
  const renderAccounts = () => (
    <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
      <ul role="list" className="mx-4 divide-y divide-white/5">
        {accounts.map((account: AccountObjectType, idx: number) => {
          const isActive = account.status === AccountStatusType.active;
          const isReadOnly =
            account.platform === AccountPlatformType.farcaster_local_readonly;
          const getTooltipText = () => {
            if (isReadOnly) {
              return "Local, read-only account";
            }
            return isActive ? `Ctrl + ${idx + 1}` : "Finish onboarding";
          };
          return (
            <li
              key={`${account.name}-${account.id}`}
              className="px-2 py-2 sm:px-3 lg:px-4"
            >
              <HotkeyTooltipWrapper hotkey={getTooltipText()} side="top">
                <div
                  onClick={() => onClickAccount(idx, isActive, isReadOnly)}
                  className="flex items-center gap-x-3 cursor-pointer group"
                >
                  {account.user?.pfp_url && (
                    <img
                      src={account.user?.pfp_url}
                      alt=""
                      className={classNames(
                        idx === selectedAccountIdx
                          ? "border-gray-100"
                          : "grayscale border-gray-400 hover:border-gray-300",
                        "-mr-1 -mt-0.5 bg-gray-100 border h-5 w-5 flex-none rounded-full"
                      )}
                    />
                  )}
                  <h3
                    className={classNames(
                      idx === selectedAccountIdx
                        ? "text-foreground"
                        : "text-foreground/60",
                      "flex-auto truncate text-sm font-normal leading-6"
                    )}
                  >
                    {account.name || PENDING_ACCOUNT_NAME_PLACEHOLDER}
                  </h3>
                  {renderStatus(account.status)}
                  {renderAccountPlatformIndicator(account.platform)}
                </div>
              </HotkeyTooltipWrapper>
            </li>
          );
        })}
      </ul>
    </Tooltip.Provider>
  );

  return (
    <div>
      <SidebarHeader title="Accounts" />
      {renderAccounts()}
    </div>
  );
};

export default AccountsOverview;
