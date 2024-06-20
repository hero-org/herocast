import React from "react";
import { classNames } from "@/common/helpers/css";
import { SidebarHeader } from "./SidebarHeader";
import { Badge } from "@/components/ui/badge";
import { useListStore } from "@/stores/useListStore";
import { take } from "lodash";
import sortBy from "lodash.sortby";
import { List } from "@/common/types/database.types";

const ListsOverview = () => {
  const { selectedList, updateSelectedList, lists } = useListStore();

  const renderList = (list: List) => {
    const shortcut = list.idx < 10 ? `Shift + ${list.idx + 1}` : "";

    return (
      <li key={`list-${list.id}`} className="px-2 sm:px-3 lg:px-4">
        <div
          onClick={() => updateSelectedList(list)}
          className={classNames(
            selectedList?.id === list.id
              ? "bg-background text-foreground font-semibold"
              : "text-foreground/80 hover:text-foreground/80 hover:bg-background",
            "flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer"
          )}
        >
          <span className="flex-nowrap truncate">{list.name}</span>
          <Badge variant="outline" className="w-16">
            {shortcut}
          </Badge>
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
