import React, { useState } from 'react';
import { useListStore, isFidList, isSearchList } from '@/stores/useListStore';
import sortBy from 'lodash.sortby';
import { List } from '@/common/types/database.types';
import { isSearchListContent, isFidListContent } from '@/common/types/list.types';

import { Button } from '@/components/ui/button';
import { UUID } from 'crypto';
import { useAccountStore } from '@/stores/useAccountStore';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, Search, Users } from 'lucide-react';
import SidebarCollapsibleHeader from './SidebarCollapsibleHeader';
import CollapsibleList from './CollapsibleList';
import { useSidebarHotkeys } from '@/common/hooks/useSidebarHotkeys';

type ListsOverviewProps = {
  onItemClick?: () => void;
};

const ListsOverview = ({ onItemClick }: ListsOverviewProps) => {
  const { selectedListId, setSelectedListId, getSearchLists, getFidLists, getAutoInteractionLists } = useListStore();
  const allLists = sortBy(
    useListStore((state) => state.lists),
    (s) => s.idx
  );
  const searchLists = getSearchLists();
  const fidLists = getFidLists();
  const autoInteractionLists = getAutoInteractionLists();
  const { setSelectedChannelUrl } = useAccountStore();
  const [isShowAllSearchLists, setIsShowAllSearchLists] = useState(false);
  const [isShowAllFidLists, setIsShowAllFidLists] = useState(false);
  const [isSearchesOpen, setIsSearchesOpen] = useState(true);
  const [isListsOpen, setIsListsOpen] = useState(true);

  const updateSelectedList = (id: UUID) => {
    setSelectedListId(id);
    setSelectedChannelUrl(null);
    if (onItemClick) onItemClick();
  };

  const renderFeedHeader = (
    title: string | JSX.Element,
    isCollapsible = false,
    isOpen = false,
    onToggle = () => {}
  ) => {
    if (isCollapsible) {
      return <SidebarCollapsibleHeader title={title} isOpen={isOpen} onToggle={onToggle} />;
    }

    return (
      <div className="px-3 py-1.5">
        <h3 className="text-sm font-semibold leading-6 text-foreground/90 flex items-center gap-x-2">{title}</h3>
      </div>
    );
  };

  const renderList = (list: List & { id: UUID }, index: number, isSearchList: boolean) => {
    const isSelected = selectedListId === list.id;
    const showNumber = index < 9;

    return (
      <div key={`list-${list.id}`} className="relative group">
        {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
        <div
          onClick={() => updateSelectedList(list.id)}
          className={cn(
            'flex items-center gap-x-3 rounded-lg mx-1 px-3 py-1.5 text-sm cursor-pointer',
            isSelected
              ? 'bg-primary/20 text-foreground font-semibold'
              : 'text-foreground/70 hover:text-foreground hover:bg-sidebar/40'
          )}
        >
          <span className="flex-1 truncate font-medium">{list.name}</span>
          {showNumber && (
            <kbd className={cn(
              'px-1 py-0.5 rounded font-mono text-[10px] opacity-0 group-hover:opacity-50 transition-opacity',
              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
            )}>
              g {isSearchList ? 's' : 'l'} {index + 1}
            </kbd>
          )}
        </div>
      </div>
    );
  };

  const renderSearchLists = () => (
    <div className="space-y-0.5 py-1">
      <CollapsibleList
        items={searchLists}
        renderItem={(item, index) => renderList(item, index, true)}
        isShowAll={isShowAllSearchLists}
        setIsShowAll={setIsShowAllSearchLists}
        footer={
          <Link href="/lists?tab=search" className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              + Add
            </Button>
          </Link>
        }
      />
    </div>
  );

  const renderFidLists = () => (
    <div className="space-y-0.5 py-1">
      <CollapsibleList
        items={fidLists}
        renderItem={(item, index) => renderList(item, index, false)}
        isShowAll={isShowAllFidLists}
        setIsShowAll={setIsShowAllFidLists}
        footer={
          <>
            <Link href="/lists" className="flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                View all
              </Button>
            </Link>
            <Link href="/lists?tab=users" className="flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                + Add
              </Button>
            </Link>
          </>
        }
      />
    </div>
  );

  const renderAddFirstSearchButton = () => (
    <Link href="/lists?tab=search" className="px-3 py-1">
      <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-muted-foreground hover:text-foreground">
        + Add search
      </Button>
    </Link>
  );

  const renderAddFirstListButton = () => (
    <Link href="/lists?tab=users" className="px-3 py-1">
      <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-muted-foreground hover:text-foreground">
        + Add list
      </Button>
    </Link>
  );

  const hasSearchLists = searchLists.length > 0;
  const hasFidLists = fidLists.length > 0;

  // Register keyboard shortcuts for sidebar navigation
  useSidebarHotkeys({
    searchLists,
    fidLists,
    onItemClick,
  });

  return (
    <div className="space-y-3">
      <div>
        {renderFeedHeader(
          <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="h-3 w-3" />
            Searches
          </span>,
          true,
          isSearchesOpen,
          () => setIsSearchesOpen(!isSearchesOpen)
        )}
        {isSearchesOpen && (hasSearchLists ? renderSearchLists() : renderAddFirstSearchButton())}
      </div>

      <div className="pt-3">
        <div className="border-t border-sidebar-border/20 mb-3" />
        {renderFeedHeader(
          <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            Lists
          </span>,
          true,
          isListsOpen,
          () => setIsListsOpen(!isListsOpen)
        )}
        {isListsOpen && (
          <>
            {hasFidLists ? (
              renderFidLists()
            ) : (
              <>
                {renderAddFirstListButton()}
                <div className="px-3 pt-1">
                  <Link href="/lists">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      View all
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ListsOverview;
