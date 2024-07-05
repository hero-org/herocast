import React from "react";
import { classNames } from "@/common/helpers/css";
import { SidebarHeader } from "./SidebarHeader";
import { useListStore } from "@/stores/useListStore";
import { take } from "lodash";
import sortBy from "lodash.sortby";
import { List } from "@/common/types/database.types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { usePostHog } from "posthog-js/react";

const ListsOverview = () => {
  const posthog = usePostHog();

  const { selectedList, updateSelectedList, removeList, lists } =
    useListStore();

  const onClickDelete = (id: string) => {
    removeList(id);
    posthog.capture("user_delete_list");
  };

  const renderList = (list: List) => {
    return (
      <li key={`list-${list.id}`} className="px-2 sm:px-3 lg:px-4">
        <div
          onClick={() => updateSelectedList(list)}
          className={classNames(
            selectedList?.id === list.id
              ? "text-foreground font-semibold"
              : "text-foreground/80 hover:text-foreground/80",
            "flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer"
          )}
        >
          <span className="flex-nowrap truncate">{list.name}</span>
          {/* 
          <Badge variant="outline" className="w-16">
            {shortcut}
          </Badge> 
          */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="rounded-lg h-8 w-6"
              >
                <EllipsisVerticalIcon className="h-3.5 w-3.5" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-lg">
              <DropdownMenuItem onClick={() => updateSelectedList(list)}>
                <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                Search
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onClickDelete(list.id)}>
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </li>
    );
  };

  return (
    <div className="">
      <SidebarHeader title="Saved Searches" />
      <ul role="list" className="mt-2 mb-12">
        {take(
          sortBy(lists, (s) => s.idx),
          10
        ).map(renderList)}
      </ul>
    </div>
  );
};

export default ListsOverview;
