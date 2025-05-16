import React from 'react';
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
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarGroupLabel
                  asChild
                  className="group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <CollapsibleTrigger>
                    Manage Lists{' '}
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
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
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarGroupLabel
                  asChild
                  className="group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <CollapsibleTrigger>
                    Searches{' '}
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
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
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarGroupLabel
                  asChild
                  className="group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <CollapsibleTrigger>
                    Channels{' '}
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
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
