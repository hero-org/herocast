import React from "react";
import {
  AccountObjectType,
  PENDING_ACCOUNT_NAME_PLACEHOLDER,
  useAccountStore,
} from "@/stores/useAccountStore";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import EmptyStateWithAction from "@/common/components/EmptyStateWithAction";
import { classNames } from "@/common/helpers/css";
import isEmpty from "lodash.isempty";
import ChannelsOverview from "./ChannelsOverview";
import { SidebarHeader } from "./SidebarHeader";
import * as Tooltip from "@radix-ui/react-tooltip";
import HotkeyTooltipWrapper from "../HotkeyTooltipWrapper";
import { useRouter } from "next/router";
import {
  AccountPlatformType,
  AccountStatusType,
} from "@/common/constants/accounts";
import { useDataStore } from "@/stores/useDataStore";
import ProfileInfo from "./ProfileInfo";

type RightSidebarProps = {
  showChannels?: boolean;
  showAuthorInfo?: boolean;
};

const RightSidebar = ({ showChannels, showAuthorInfo }: RightSidebarProps) => {
  const router = useRouter();

  const { hydratedAt, accounts, selectedAccountIdx, setCurrentAccountIdx } =
    useAccountStore();
  const { selectedCast } = useDataStore();

  const selectedAccount = accounts[selectedAccountIdx];

  const hasAccounts = !isEmpty(accounts);
  const renderEmptyState = () => (
    <div className="ml-6">
      <EmptyStateWithAction
        title="Connect Farcaster accounts"
        description="Get started with herocast"
        onClick={() => router.push("/accounts")}
        submitText="Connect account"
      />
    </div>
  );

  const renderChannels = () => {
    return (
      <div className="mt-4">
        <ChannelsOverview />
      </div>
    );
  };

  const renderAuthorInfo = () => {
    if (!showAuthorInfo || !selectedCast ) return null;

    return (
      <div className="m-4">
        <ProfileInfo
          fid={selectedCast.author.fid}
          viewerFid={Number(selectedAccount.platformAccountId)}
        />
      </div>
    );
  };

  return (
    <aside className="min-h-full bg-background md:fixed md:bottom-0 md:right-0 md:top-16 md:w-48 lg:w-64 md:border-l md:border-foreground/5">
      <div className="">
        {renderAuthorInfo()}
        {hydratedAt && !hasAccounts && renderEmptyState()}
        {showChannels && renderChannels()}
      </div>
    </aside>
  );
};

export default RightSidebar;
