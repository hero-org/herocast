import React from 'react';
import { useAccountStore } from '@/stores/useAccountStore';
import EmptyStateWithAction from '@/common/components/EmptyStateWithAction';
import isEmpty from 'lodash.isempty';
import ChannelsOverview from './ChannelsOverview';
import { useRouter } from 'next/router';
import { useDataStore } from '@/stores/useDataStore';
import ProfileInfo from '../ProfileInfo';
import SearchesOverview from './SearchesOverview';
import ListsOverview from './ListsOverview';
import ManageListsOverview from './ManageListsOverview';
import { Separator } from '@/components/ui/separator';

type RightSidebarProps = {
  showFeeds?: boolean;
  showSearches?: boolean;
  showAuthorInfo?: boolean;
  showManageLists?: boolean;
  showLists?: boolean;
};

const RightSidebar = ({ showFeeds, showSearches, showLists, showManageLists, showAuthorInfo }: RightSidebarProps) => {
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
        onClick={() => router.push('/accounts')}
        submitText="Connect account"
      />
    </div>
  );

  const renderAuthorInfo = () => {
    if (!showAuthorInfo || !selectedCast) return null;

    if (
      !selectedAccount?.platformAccountId ||
      selectedAccount?.platformAccountId === selectedCast.author.fid.toString()
    ) {
      return null;
    }

    return (
      <>
        <div className="mt-16 mx-4">
          <ProfileInfo
            fid={selectedCast.author.fid}
            viewerFid={Number(selectedAccount.platformAccountId)}
            showFullInfo
          />
        </div>
        <Separator className="my-2" />
      </>
    );
  };

  const renderWithSeparator = (component: JSX.Element, showSeparator?: boolean) => (
    <>
      {showSeparator !== undefined && showSeparator && <Separator className="my-2" />}
      {component}
    </>
  );

  return (
    <aside
      style={{
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        WebkitScrollbar: 'none',
      }}
      className="h-screen sticky top-0 bg-muted/40 w-full md:border-l md:border-foreground/5 overflow-y-auto"
    >
      <div>
        {isHydrated && renderAuthorInfo()}
        {isHydrated && !hasAccounts && renderEmptyState()}
        {showFeeds && <ChannelsOverview />}
        {showLists && renderWithSeparator(<ListsOverview />)}
        {showManageLists && renderWithSeparator(<ManageListsOverview />, showFeeds || showLists)}
        {showSearches && <SearchesOverview />}
      </div>
    </aside>
  );
};

export default RightSidebar;
