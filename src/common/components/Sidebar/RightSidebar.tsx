import React from "react";
import { useAccountStore } from "@/stores/useAccountStore";
import EmptyStateWithAction from "@/common/components/EmptyStateWithAction";
import isEmpty from "lodash.isempty";
import ChannelsOverview from "./ChannelsOverview";
import { useRouter } from "next/router";
import { useDataStore } from "@/stores/useDataStore";
import ProfileInfo from "./ProfileInfo";
import SearchesOverview from "./SearchesOverview";
import ListsOverview from "./ListsOverview";

type RightSidebarProps = {
  showChannels?: boolean;
  showSearches?: boolean;
  showAuthorInfo?: boolean;
  showLists?: boolean;
};

const RightSidebar = ({
  showChannels,
  showSearches,
  showLists,
  showAuthorInfo,
}: RightSidebarProps) => {
  const router = useRouter();

  const { isHydrated, accounts, selectedAccountIdx } = useAccountStore();
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

  const renderAuthorInfo = () => {
    if (!showAuthorInfo || !selectedCast) return null;

    return (
      <div className="pt-16 mx-4">
        <ProfileInfo
          fid={selectedCast.author.fid}
          viewerFid={Number(selectedAccount.platformAccountId)}
        />
      </div>
    );
  };

  return (
    <aside
      style={{
        "msOverflowStyle": "none",
        "scrollbarWidth": "none",
        "-webkit-scrollbar": "none",
      }}
      className="min-h-full h-full bg-muted/40 md:fixed md:bottom-0 md:right-0 md:w-48 lg:w-64 md:border-l md:border-foreground/5 overflow-y-auto"
    >
      <div className="">
        {isHydrated && renderAuthorInfo()}
        {isHydrated && !hasAccounts && renderEmptyState()}
        {showChannels && <ChannelsOverview />}
        {showLists && <ListsOverview />}
        {showSearches && <SearchesOverview />}
      </div>
    </aside>
  );
};

export default RightSidebar;
