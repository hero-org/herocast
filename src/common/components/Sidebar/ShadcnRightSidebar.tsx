import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAccountStore } from '@/stores/useAccountStore';
import { useDataStore } from '@/stores/useDataStore';
import { useSidebar } from '@/components/ui/sidebar';
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
import EmptyStateWithAction from '@/common/components/EmptyStateWithAction';
import ProfileInfo from '../ProfileInfo';
import ChannelsOverview from './ChannelsOverview';
import SearchesOverview from './SearchesOverview';
import ListsOverview from './ListsOverview';
import ManageListsOverview from './ManageListsOverview';
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
  const { setOpenMobile, isMobile } = useSidebar();

  // Close sidebar on mobile when an item is clicked
  const handleItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
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

  // Fixed header: Always show user info to prevent content jumping
  const renderUserHeader = () => {
    if (!showAuthorInfo || !hasAccounts) return null;

    // Show cast author if different from current user, otherwise show current user
    const shouldShowAuthor =
      selectedCast &&
      selectedAccount?.platformAccountId &&
      selectedAccount?.platformAccountId !== selectedCast.author.fid.toString();

    const fid = shouldShowAuthor ? selectedCast.author.fid : Number(selectedAccount?.platformAccountId);
    const viewerFid = Number(selectedAccount?.platformAccountId);

    if (!fid || !viewerFid) return null;

    return (
      <>
        <SidebarGroup className="bg-sidebar/30 border-b border-sidebar-border">
          <SidebarGroupContent className="px-4 py-3">
            <div className="min-h-[120px] flex flex-col justify-center">
              <ProfileInfo fid={fid} viewerFid={viewerFid} showFullInfo />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </>
    );
  };

  return (
    <Sidebar
      side="right"
      collapsible="offcanvas"
      className="border-l border-sidebar-border hidden lg:flex bg-sidebar/50"
    >
      <SidebarContent className="flex flex-col h-full">
        {/* Fixed header - always rendered to prevent content jumping */}
        {isHydrated && renderUserHeader()}

        {/* Empty state for no accounts */}
        {isHydrated && !hasAccounts && renderEmptyState()}

        {showLists && (
          <SidebarGroup className="py-1">
            <SidebarGroupContent>
              <ListsOverview onItemClick={handleItemClick} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

          {showManageLists && (
            <SidebarGroup className="px-0 py-0 border-t border-sidebar-border/50">
              <Collapsible open={isManageListsOpen} onOpenChange={setIsManageListsOpen}>
                <div className="px-3 py-1.5">
                  <SidebarCollapsibleHeader
                    title="Manage Lists"
                    isOpen={isManageListsOpen}
                    onToggle={() => setIsManageListsOpen(!isManageListsOpen)}
                  />
                </div>
                <CollapsibleContent>
                  <SidebarGroupContent className="px-2">
                    <ManageListsOverview onItemClick={handleItemClick} />
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          )}

          {showSearches && (
            <SidebarGroup className="px-0 py-0 border-t border-sidebar-border/50">
              <Collapsible open={isSearchesOpen} onOpenChange={setIsSearchesOpen}>
                <div className="px-3 py-1.5">
                  <SidebarCollapsibleHeader
                    title="Searches"
                    isOpen={isSearchesOpen}
                    onToggle={() => setIsSearchesOpen(!isSearchesOpen)}
                  />
                </div>
                <CollapsibleContent>
                  <SidebarGroupContent className="px-2 pb-2">
                    <SearchesOverview onItemClick={handleItemClick} />
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          )}

          {showFeeds && (
            <SidebarGroup className="px-0 py-0 border-t border-sidebar-border/50">
              <Collapsible open={isChannelsOpen} onOpenChange={setIsChannelsOpen}>
                <div className="px-3 py-1.5">
                  <SidebarCollapsibleHeader
                    title="Channels"
                    isOpen={isChannelsOpen}
                    onToggle={() => setIsChannelsOpen(!isChannelsOpen)}
                  />
                </div>
                <CollapsibleContent>
                  <SidebarGroupContent className="px-2 pb-2">
                    <ChannelsOverview onItemClick={handleItemClick} />
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

export default ShadcnRightSidebar;
