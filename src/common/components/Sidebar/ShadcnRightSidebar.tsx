import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAccountStore } from '@/stores/useAccountStore';
import { useDataStore } from '@/stores/useDataStore';
import isEmpty from 'lodash.isempty';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import EmptyStateWithAction from '@/common/components/EmptyStateWithAction';
import ProfileInfo from '../ProfileInfo';
import ChannelsOverview from './ChannelsOverview';
import SearchesOverview from './SearchesOverview';
import ListsOverview from './ListsOverview';
import ManageListsOverview from './ManageListsOverview';
import { Separator } from '@/components/ui/separator';
import SidebarCollapsibleHeader from './SidebarCollapsibleHeader';

type ShadcnRightSidebarProps = {
  showFeeds?: boolean;
  showSearches?: boolean;
  showAuthorInfo?: boolean;
  showManageLists?: boolean;
  showLists?: boolean;
};

const ShadcnRightSidebar = ({
  showFeeds,
  showSearches,
  showLists,
  showManageLists,
  showAuthorInfo,
}: ShadcnRightSidebarProps) => {
  const [isManageListsOpen, setIsManageListsOpen] = useState(true);
  const [isSearchesOpen, setIsSearchesOpen] = useState(true);
  const [isChannelsOpen, setIsChannelsOpen] = useState(true);
  const router = useRouter();
  const { isHydrated, accounts, selectedAccountIdx } = useAccountStore();
  const { selectedCast } = useDataStore();
  const selectedAccount = accounts[selectedAccountIdx];
  const hasAccounts = !isEmpty(accounts);

  const renderEmptyState = () => (
    <SidebarGroup>
      <SidebarGroupContent>
        <EmptyStateWithAction
          title="Connect Farcaster accounts"
          description="Get started with herocast"
          onClick={() => router.push('/accounts')}
          submitText="Connect account"
        />
      </SidebarGroupContent>
    </SidebarGroup>
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
        <SidebarGroup>
          <SidebarGroupContent>
            <ProfileInfo
              fid={selectedCast.author.fid}
              viewerFid={Number(selectedAccount.platformAccountId)}
              showFullInfo
            />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="mx-0" />
      </>
    );
  };

  return (
    <Sidebar
      side="right"
      collapsible="offcanvas"
      className="border-l border-sidebar-border hidden lg:flex [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]"
    >
      <SidebarContent>
        {isHydrated && renderAuthorInfo()}
        {isHydrated && !hasAccounts && renderEmptyState()}

        {showLists && (
          <SidebarGroup className="py-0">
            <SidebarGroupContent>
              <ListsOverview />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showManageLists && (
          <>
            <SidebarSeparator className="mx-0" />
            <SidebarGroup className="py-0">
              <Collapsible open={isManageListsOpen} onOpenChange={setIsManageListsOpen}>
                <div className="px-2 py-1">
                  <SidebarCollapsibleHeader
                    title="Manage Lists"
                    isOpen={isManageListsOpen}
                    onToggle={() => setIsManageListsOpen(!isManageListsOpen)}
                  />
                </div>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <ManageListsOverview />
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          </>
        )}

        {showSearches && (
          <>
            <SidebarSeparator className="mx-0" />
            <SidebarGroup className="py-0">
              <Collapsible open={isSearchesOpen} onOpenChange={setIsSearchesOpen}>
                <div className="px-2 py-1">
                  <SidebarCollapsibleHeader
                    title="Searches"
                    isOpen={isSearchesOpen}
                    onToggle={() => setIsSearchesOpen(!isSearchesOpen)}
                  />
                </div>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SearchesOverview />
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          </>
        )}

        {showFeeds && (
          <>
            <SidebarSeparator className="mx-0" />
            <SidebarGroup className="py-0">
              <Collapsible open={isChannelsOpen} onOpenChange={setIsChannelsOpen}>
                <div className="px-2 py-1">
                  <SidebarCollapsibleHeader
                    title="Channels"
                    isOpen={isChannelsOpen}
                    onToggle={() => setIsChannelsOpen(!isChannelsOpen)}
                  />
                </div>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <ChannelsOverview />
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
};

export default ShadcnRightSidebar;
