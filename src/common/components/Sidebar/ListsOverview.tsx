import React from "react";
import { SidebarHeader } from "./SidebarHeader";
import { useListStore } from "@/stores/useListStore";
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
    Cog6ToothIcon,
    BellIcon,
    EnvelopeIcon,
} from "@heroicons/react/24/outline";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { UUID } from "crypto";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccountStore } from "@/stores/useAccountStore";
import UpgradeFreePlanCard from "../UpgradeFreePlanCard";
import { cn } from "@/lib/utils";

const ListsOverview = () => {
    const { searches, selectedListId, setSelectedListId, addList, lists } = useListStore();
    const { accounts, selectedAccountIdx } = useAccountStore();
    const selectedAccountId = accounts[selectedAccountIdx]?.id;

    const { setIsManageListModalOpen } = useNavigationStore();

    const onOpenManageListModal = (id: UUID) => {
        updateSelectedList(id);
        setIsManageListModalOpen(true);
    };

    const updateSelectedList = (id: UUID) => {
        setSelectedListId(id);
    };

    const onClickSaveLastSearch = () => {
        const lastSearch = searches[searches.length - 1];
        if (lastSearch && selectedAccountId) {
            addList({
                name: lastSearch.term,
                account_id: selectedAccountId,
                contents: {
                    term: lastSearch.term,
                },
                idx: 0,
                type: "search",
            });
        }
    };

    const renderList = (list: List & { id: UUID }) => {
        const isSelected = selectedListId === list.id;

        return (
            <li key={`list-${list.id}`} className="px-2 sm:px-3 lg:px-4">
                <div
                    onClick={() => updateSelectedList(list.id)}
                    className={cn(
                        isSelected ? "text-foreground font-semibold" : "text-foreground/80 hover:text-foreground/80",
                        "flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer"
                    )}
                >
                    <span className="flex-nowrap truncate">{list.name}</span>
                    <div className="flex">
                        {list?.contents?.enabled_daily_email && (
                            <EnvelopeIcon className="h-4 w-4 mt-1 mr-1 text-muted-foreground/50" />
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="outline" className="rounded-lg h-6 w-5">
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
                </div>
            </li>
        );
    };

    const renderEmptyListsCard = () => (
        <Card className="m-4">
            <CardHeader>
                <CardTitle className="text-sm flex items-center">No saved searches yet</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>Save your searches to quickly access them later</CardDescription>
            </CardContent>
            {searches.length > 0 && (
                <CardFooter>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={searches.length === 0 || !selectedAccountId}
                        onClick={() => onClickSaveLastSearch()}
                    >
                        Save last search
                    </Button>
                </CardFooter>
            )}
        </Card>
    );

    const renderLists = () => (
        <div className="flex flex-col">
            <UpgradeFreePlanCard limit="maxSavedSearches" />
            <ul role="list" className="mt-2 mb-12">
                {sortBy(lists, (s) => s.idx).map(renderList)}
            </ul>
        </div>
    );
    return (
        <div className="">
            <SidebarHeader
                title={
                    <span className="flex align-center">
                        <BellIcon className="h-5 w-5 mt-1 mr-1" />
                        Saved Searches
                    </span>
                }
            />
            {lists.length === 0 ? renderEmptyListsCard() : renderLists()}
        </div>
    );
};

export default ListsOverview;
