import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccountStore } from '@/stores/useAccountStore';
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
import ChannelsOverview from './ChannelsOverview';
import SearchesOverview from './SearchesOverview';
import ListsOverview from './ListsOverview';
import ManageListsOverview from './ManageListsOverview';
import SidebarCollapsibleHeader from './SidebarCollapsibleHeader';

type ShadcnRightSidebarProps = {
  showFeeds?: boolean;
  showSearches?: boolean;
  showManageLists?: boolean;
  showLists?: boolean;
};

const ShadcnRightSidebar = ({ showFeeds, showSearches, showLists, showManageLists }: ShadcnRightSidebarProps) => {
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
  const { isHydrated, accounts } = useAccountStore();
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

  return (
    <Sidebar side="right" collapsible="offcanvas" className="border-l border-sidebar-border/50 hidden lg:flex">
      <SidebarContent className="flex flex-col h-full">
        {/* Empty state for no accounts */}
        {isHydrated && !hasAccounts && renderEmptyState()}

        {showLists && (
          <SidebarGroup className="pt-6 pb-3">
            <SidebarGroupContent>
              <ListsOverview onItemClick={handleItemClick} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showManageLists && (
          <SidebarGroup className="pt-6 pb-3">
            <Collapsible open={isManageListsOpen} onOpenChange={setIsManageListsOpen}>
              <div className="px-3 pb-2">
                <SidebarCollapsibleHeader
                  title="Manage Lists"
                  isOpen={isManageListsOpen}
                  onToggle={() => setIsManageListsOpen(!isManageListsOpen)}
                />
              </div>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <ManageListsOverview onItemClick={handleItemClick} />
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {showSearches && (
          <SidebarGroup className="pt-6 pb-3">
            <Collapsible open={isSearchesOpen} onOpenChange={setIsSearchesOpen}>
              <div className="px-3 pb-2">
                <SidebarCollapsibleHeader
                  title="Searches"
                  isOpen={isSearchesOpen}
                  onToggle={() => setIsSearchesOpen(!isSearchesOpen)}
                />
              </div>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SearchesOverview onItemClick={handleItemClick} />
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {showFeeds && (
          <SidebarGroup className="pt-6 pb-3">
            <SidebarGroupContent>
              <ChannelsOverview onItemClick={handleItemClick} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
};

export default ShadcnRightSidebar;
