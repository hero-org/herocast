import React from "react";
import {
  useAccountStore,
} from "@/stores/useAccountStore";
import EmptyStateWithAction from "@/common/components/EmptyStateWithAction";
import isEmpty from "lodash.isempty";
import ChannelsOverview from "./ChannelsOverview";
import { useRouter } from "next/router";
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
    if (!showAuthorInfo || !selectedCast) return null;

    return (
      <div className="mt-2 mx-4">
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
