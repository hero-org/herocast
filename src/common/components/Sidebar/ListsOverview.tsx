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

const ListsOverview = () => {
  const { selectedListId, setSelectedListId, getSearchLists, getFidLists } = useListStore();
  const allLists = sortBy(
    useListStore((state) => state.lists),
    (s) => s.idx
  );
  const searchLists = getSearchLists();
  const fidLists = getFidLists();
  const { setSelectedChannelUrl } = useAccountStore();
  const [isShowAllSearchLists, setIsShowAllSearchLists] = useState(false);
  const [isShowAllFidLists, setIsShowAllFidLists] = useState(false);

  const updateSelectedList = (id: UUID) => {
    setSelectedListId(id);
    setSelectedChannelUrl(null);
  };

  const renderFeedHeader = (title: string | JSX.Element, button?) => {
    return (
      <div className="flex items-center px-4 py-1 sm:px-4">
        <h3 className="mr-2 text-md font-semibold leading-7 tracking-tight text-primary">{title}</h3>
        {button}
      </div>
    );
  };

  const renderList = (list: List & { id: UUID }) => {
    const isSelected = selectedListId === list.id;

    return (
      <li key={`list-${list.id}`}>
        <div
          onClick={() => updateSelectedList(list.id)}
          className={cn(
            isSelected ? 'text-foreground font-semibold' : 'text-foreground/80 hover:text-foreground/80',
            'flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer'
          )}
        >
          <span className="flex-nowrap truncate">{list.name}</span>
        </div>
      </li>
    );
  };

  const renderSearchLists = () => (
    <div className="flex flex-col">
      <ul role="list" className="px-4 py-1 sm:px-4">
        <Collapsible open={isShowAllSearchLists} onOpenChange={setIsShowAllSearchLists}>
          {searchLists.slice(0, 5).map(renderList)}
          <CollapsibleContent className="">{searchLists.slice(5).map(renderList)}</CollapsibleContent>
          {searchLists.length > 5 && (
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 px-1">
                <span className="">Show {isShowAllSearchLists ? 'less' : 'more'}</span>
              </Button>
            </CollapsibleTrigger>
          )}
        </Collapsible>
      </ul>
    </div>
  );

  const renderFidLists = () => (
    <div className="flex flex-col">
      <ul role="list" className="px-4 py-1 sm:px-4">
        <Collapsible open={isShowAllFidLists} onOpenChange={setIsShowAllFidLists}>
          {fidLists.slice(0, 5).map(renderList)}
          <CollapsibleContent className="">{fidLists.slice(5).map(renderList)}</CollapsibleContent>
          {fidLists.length > 5 && (
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 px-1">
                <span className="">Show {isShowAllFidLists ? 'less' : 'more'}</span>
              </Button>
            </CollapsibleTrigger>
          )}
        </Collapsible>
      </ul>
    </div>
  );

  const renderAddFirstSearchButton = () => (
    <Link href="/search" className="px-4 py-3 sm:px-4 sm:py-3">
      <Button size="sm" className="mt-2">
        Add keyword search
      </Button>
    </Link>
  );

  const renderAddFirstListButton = () => (
    <Link href="/list" className="px-4 py-3 sm:px-4 sm:py-3">
      <Button size="sm" className="mt-2">
        Add user list
      </Button>
    </Link>
  );

  const hasSearchLists = searchLists.length > 0;
  const hasFidLists = fidLists.length > 0;

  return (
    <div>
      {renderFeedHeader(
        <span className="flex">
          <MagnifyingGlassIcon className="mt-1 mr-1 h-5 w-5" aria-hidden="true" />
          Searches
        </span>,
        <Link href="/search">
          <Button variant="outline" className="h-6 px-2">
            Add<span className="hidden ml-1 lg:block">search</span>
          </Button>
        </Link>
      )}
      {hasSearchLists ? renderSearchLists() : renderAddFirstSearchButton()}

      <div className="mt-6">
        {renderFeedHeader(
          <span className="flex">
            <UserGroupIcon className="mt-1 mr-1 h-5 w-5" aria-hidden="true" />
            Lists
          </span>,
          <Link href="/list">
            <Button variant="outline" className="h-6 px-2">
              Add<span className="hidden ml-1 lg:block">list</span>
            </Button>
          </Link>
        )}
        {hasFidLists ? renderFidLists() : renderAddFirstListButton()}
      </div>
    </div>
  );
};

export default ListsOverview;
