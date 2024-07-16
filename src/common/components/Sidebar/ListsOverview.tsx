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
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { UUID } from "crypto";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ListsOverview = () => {
  const { selectedListIdx, setSelectedListIdx, lists } = useListStore();

  const { setIsManageListModalOpen } = useNavigationStore();

  const onOpenManageListModal = (id: UUID) => {
    updateSelectedList(id);
    setIsManageListModalOpen(true);
  };

  const updateSelectedList = (id: UUID) => {
    setSelectedListIdx(lists.findIndex((l) => l.id === id));
  };

  const renderList = (list: List & { id: UUID }, idx: number) => {
    return (
      <li key={`list-${list.id}`} className="px-2 sm:px-3 lg:px-4">
        <div
          onClick={() => updateSelectedList(list.id)}
          className={classNames(
            selectedListIdx === idx
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
              <DropdownMenuItem onClick={() => updateSelectedList(list.id)}>
                <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                Search
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onOpenManageListModal(list.id)}>
                <Cog6ToothIcon className="h-4 w-4 mr-2" />
                Manage
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
      {lists.length === 0 ? (
        <Card className="mt-2 mb-12">
          <CardHeader>
            <CardTitle className="text-sm flex items-center">
              <InformationCircleIcon className="h-5 w-5 text-primary mr-2" />
              No saved searches yet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Create a new search to see it here.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <ul role="list" className="mt-2 mb-12">
          {take(
            sortBy(lists, (s) => s.idx),
            10
          ).map(renderList)}
        </ul>
      )}
    </div>
  );
};

export default ListsOverview;
