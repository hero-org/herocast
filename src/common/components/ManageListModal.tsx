import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { usePostHog } from "posthog-js/react";
import { useListStore } from "@/stores/useListStore";
import { UUID } from "crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInterval, SearchIntervalFilter } from "./SearchIntervalFilter";
import { Switch } from "@/components/ui/switch";
import { useHotkeys } from "react-hotkeys-hook";
import { Key } from "ts-key-enum";
import { toastSuccessSavedSearchUpdate } from "../helpers/toast";
import { BellIcon } from "@heroicons/react/24/outline";

const ManageListModal = ({ open, onClose }) => {
  const posthog = usePostHog();

  const { updateList, removeList } = useListStore();
  const [newName, setNewName] = useState("");
  const [newSearchTerm, setNewSearchTerm] = useState("");

  const list = useListStore((state) =>
    state.selectedListIdx !== undefined
      ? state.lists[state.selectedListIdx]
      : undefined
  );
  const canSave =
    list && (newName !== list.name || newSearchTerm !== list.contents?.term);

  const onClickDelete = (id: UUID) => {
    removeList(id);
    posthog.capture("user_delete_list");
  };

  useEffect(() => {
    if (!list) return;

    setNewName(list?.name);
    setNewSearchTerm(list?.contents?.term);
  }, [list]);

  const onClickSave = () => {
    if (!list || !canSave) return;

    updateList({
      ...list,
      name: newName,
      contents: {
        ...list.contents,
        term: newSearchTerm,
      },
    }).then(() => {
      toastSuccessSavedSearchUpdate(newName);
      onClose();
    });
    posthog.capture("user_save_list");
  };

  if (!list) return null;

  const searchIntervalKey = Object.keys(SearchInterval).find(
    (key) => SearchInterval[key] === list?.contents?.filters?.interval
  );
  const searchInterval = searchIntervalKey
    ? SearchInterval[searchIntervalKey]
    : undefined;

  return (
    <Modal open={open} setOpen={onClose} title="Manage Saved Search">
      <div className="flex flex-col gap-4 mt-4">
        <div>
          <Label>Change Name</Label>
          <Input
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div>
          <Label>Change search</Label>
          <Input
            label="Search"
            value={newSearchTerm}
            onChange={(e) => setNewSearchTerm(e.target.value)}
          />
        </div>
        <div className=" flex items-center space-x-4 rounded-md border p-4">
          <BellIcon />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium leading-none">
              Push Notifications
            </p>
            <p className="text-sm text-muted-foreground">
              Send notifications to device.
            </p>
          </div>
          <Switch />
        </div>
        <div className="flex flex-row space-x-4">
          <div className="flex flex-col">
            <Label>Search Interval</Label>
            <SearchIntervalFilter defaultInterval={searchInterval} />
          </div>
          <div className="flex flex-col">
            <Label>Hide replies</Label>
            <Switch disabled checked={list.contents?.filters?.hideReplies} />
          </div>
          <div className="flex flex-col">
            <Label>Only power badge</Label>
            <Switch disabled checked={list.contents?.filters?.onlyPowerBadge} />
          </div>
        </div>
        <div className="flex justify-end gap-4">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onClickDelete(list.id)}
          >
            Delete List
          </Button>
          <Button disabled={!canSave} size="sm" onClick={() => onClickSave()}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ManageListModal;
