import React, { useState } from "react";
import { useListStore } from "@/stores/useListStore";
import sortBy from "lodash.sortby";
import { List } from "@/common/types/database.types";

import { Button } from "@/components/ui/button";
import { UUID } from "crypto";
import { useAccountStore } from "@/stores/useAccountStore";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";

const ListsOverview = () => {
  const { selectedListId, setSelectedListId } = useListStore();
  const lists = sortBy(
    useListStore((state) => state.lists),
    (s) => s.idx
  );
  const { setSelectedChannelUrl } = useAccountStore();
  const [isShowAllLists, setIsShowAllLists] = useState(true);

  const updateSelectedList = (id: UUID) => {
    setSelectedListId(id);
    setSelectedChannelUrl(null);
  };

  const renderFeedHeader = (title: string, button?) => {
    return (
      <div className="flex items-center px-4 py-1 sm:px-4">
        <h3 className="mr-2 text-md font-semibold leading-7 tracking-tight text-primary">
          {title}
        </h3>
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
            isSelected
              ? "text-foreground font-semibold"
              : "text-foreground/80 hover:text-foreground/80",
            "flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer"
          )}
        >
          <span className="flex-nowrap truncate">{list.name}</span>
        </div>
      </li>
    );
  };

  const renderLists = () => (
    <div className="flex flex-col">
      <ul role="list" className="px-4 py-1 sm:px-4">
        <Collapsible open={isShowAllLists} onOpenChange={setIsShowAllLists}>
          {lists.slice(0, 5).map(renderList)}
          <CollapsibleContent className="">
            {lists.slice(5).map(renderList)}
          </CollapsibleContent>
          {lists.length > 5 && (
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 px-1">
                <span className="">
                  Show {isShowAllLists ? "less" : "more"}
                </span>
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

  const hasLists = lists.length > 0;

  return (
    <div className="">
      {renderFeedHeader(
        <span className="flex">
          <MagnifyingGlassIcon
            className="mt-1 mr-1 h-5 w-5"
            aria-hidden="true"
          />
          Searches
        </span>,
        <Link href="/search">
          <Button variant="outline" className="h-6 px-2">
            Add search
          </Button>
        </Link>
      )}
      {hasLists ? renderLists() : renderAddFirstSearchButton()}
    </div>
  );
};

export default ListsOverview;
