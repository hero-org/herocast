import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { usePostHog } from "posthog-js/react";
import { useListStore } from "@/stores/useListStore";
import { UUID } from "crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntervalFilter } from "./IntervalFilter";
import { Interval } from "../helpers/search";
import { Switch } from "@/components/ui/switch";
import { toastSuccessSavedSearchUpdate } from "../helpers/toast";
import { BellIcon } from "@heroicons/react/24/outline";

const ManageListModal = ({ open, onClose }) => {
  const posthog = usePostHog();

  const { updateList, removeList } = useListStore();
  const [newName, setNewName] = useState("");
  const [newSearchTerm, setNewSearchTerm] = useState("");
  const [isDailyEmailEnabled, setIsDailyEmailEnabled] = useState(false);

  const list = useListStore((state) =>
    state.selectedListId !== undefined
      ? state.lists.find((l) => l.id === state.selectedListId)
      : undefined
  );
  const canSave =
    list &&
    (newName !== list.name ||
      newSearchTerm !== list.contents?.term ||
      isDailyEmailEnabled !== list.contents?.enabled_daily_email
    );

  const onClickDelete = (id: UUID) => {
    removeList(id);
    posthog.capture("user_delete_list");
  };

  useEffect(() => {
    if (!list) return;

    setNewName(list?.name);
    setNewSearchTerm(list?.contents?.term);
    setIsDailyEmailEnabled(list?.contents?.enabled_daily_email);
  }, [list]);

  const onClickSave = () => {
    if (!list || !canSave) return;

    const newContents = {
      ...list.contents,
      term: newSearchTerm,
      enabled_daily_email: isDailyEmailEnabled,
    };
    updateList({
      ...list,
      name: newName,
      contents: newContents,
    }).then(() => {
      toastSuccessSavedSearchUpdate(newName);
      onClose();
    });
    posthog.capture("user_save_list");
  };

  if (!list) return null;

  const searchIntervalKey = Object.keys(Interval).find(
    (key) => Interval[key] === list?.contents?.filters?.interval
  );
  const searchInterval = searchIntervalKey
    ? Interval[searchIntervalKey]
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
        <div className="flex flex-col">
          <Label className="flex">
            <BellIcon className="h-5 w-5 mr-1" />
            Daily Email Alert
          </Label>
          <Switch
            className="mt-2"
            checked={isDailyEmailEnabled}
            onCheckedChange={() => setIsDailyEmailEnabled(!isDailyEmailEnabled)}
          />
        </div>
        <div className="flex flex-row space-x-4">
          <div className="flex flex-col">
            <Label>Search Interval</Label>
            <IntervalFilter defaultInterval={searchInterval} />
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
