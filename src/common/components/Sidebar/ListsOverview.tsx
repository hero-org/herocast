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
import { MagnifyingGlassIcon, UserGroupIcon } from '@heroicons/react/20/solid';
import { ChevronRight } from 'lucide-react';
import SidebarCollapsibleHeader from './SidebarCollapsibleHeader';
import CollapsibleList from './CollapsibleList';

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
    button?,
    isCollapsible = false,
    isOpen = false,
    onToggle = () => {}
  ) => {
    if (isCollapsible) {
      return <SidebarCollapsibleHeader title={title} button={button} isOpen={isOpen} onToggle={onToggle} />;
    }

    return (
      <div className="flex items-center justify-between px-3 py-1.5">
        <h3 className="text-sm font-semibold leading-6 text-foreground/90 flex items-center gap-x-2">{title}</h3>
        {button}
      </div>
    );
  };

  const renderList = (list: List & { id: UUID }) => {
    const isSelected = selectedListId === list.id;

    return (
      <div key={`list-${list.id}`} className="px-1">
        <div
          onClick={() => updateSelectedList(list.id)}
          className={cn(
            'flex items-center gap-x-3 rounded-lg px-3 py-1.5 text-sm cursor-pointer',
            isSelected
              ? 'bg-primary text-primary-foreground shadow-sm font-medium'
              : 'text-foreground/70 hover:text-foreground hover:bg-sidebar/40'
          )}
        >
          <span className="flex-1 truncate font-medium">{list.name}</span>
          {isSelected && <div className="ml-auto w-2 h-2 bg-primary-foreground rounded-full" />}
        </div>
      </div>
    );
  };

  const renderSearchLists = () => (
    <div className="space-y-0.5 py-1">
      <CollapsibleList
        items={searchLists}
        renderItem={(item) => renderList(item)}
        isShowAll={isShowAllSearchLists}
        setIsShowAll={setIsShowAllSearchLists}
      />
    </div>
  );

  const renderFidLists = () => (
    <div className="space-y-0.5 py-1">
      <CollapsibleList
        items={fidLists}
        renderItem={(item) => renderList(item)}
        isShowAll={isShowAllFidLists}
        setIsShowAll={setIsShowAllFidLists}
      />
    </div>
  );

  const renderAddFirstSearchButton = () => (
    <Link href="/lists?tab=search" className="px-3 py-2">
      <Button size="sm" variant="outline" className="w-full border-dashed h-8">
        Add keyword search
      </Button>
    </Link>
  );

  const renderAddFirstListButton = () => (
    <Link href="/lists?tab=users" className="px-3 py-2">
      <Button size="sm" variant="outline" className="w-full border-dashed h-8">
        Add user list
      </Button>
    </Link>
  );

  const hasSearchLists = searchLists.length > 0;
  const hasFidLists = fidLists.length > 0;

  return (
    <div className="space-y-3">
      <div>
        {renderFeedHeader(
          <span className="flex items-center gap-x-2">
            <MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" />
            <span>Searches</span>
          </span>,
          <Link href="/lists?tab=search" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs hover:bg-sidebar/40">
              Add
            </Button>
          </Link>,
          true,
          isSearchesOpen,
          () => setIsSearchesOpen(!isSearchesOpen)
        )}
        {isSearchesOpen && (hasSearchLists ? renderSearchLists() : renderAddFirstSearchButton())}
      </div>

      <div className="pt-1">
        <div className="border-t border-sidebar-border/30" />
        <div className="pt-2">
          {renderFeedHeader(
            <span className="flex items-center gap-x-2">
              <UserGroupIcon className="h-4 w-4" aria-hidden="true" />
              <span>Lists</span>
            </span>,
            <Link href="/lists?tab=users" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs hover:bg-sidebar/40">
                Add
              </Button>
            </Link>,
            true,
            isListsOpen,
            () => setIsListsOpen(!isListsOpen)
          )}
          {isListsOpen && (hasFidLists ? renderFidLists() : renderAddFirstListButton())}
        </div>
      </div>

      {/* View all lists button */}
      <div className="px-3 pt-2">
        <Link href="/lists">
          <Button variant="outline" size="sm" className="w-full">
            View All Lists & Automations
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default ListsOverview;
