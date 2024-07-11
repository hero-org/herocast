import React from "react";
import Modal from "./Modal";
import { usePostHog } from "posthog-js/react";
import { useListStore } from "@/stores/useListStore";
import { UUID } from "crypto";
import { Button } from "@/components/ui/button";

const ManageListModal = ({ open, onClose }) => {
  const posthog = usePostHog();

  const { updateList, removeList } = useListStore();

  const list = useListStore((state) =>
    state.selectedListIdx !== undefined
      ? state.lists[state.selectedListIdx]
      : undefined
  );
  const onClickDelete = (id: UUID) => {
    removeList(id);
    posthog.capture("user_delete_list");
  };

  const onClickSave = () => {

    posthog.capture("user_save_list");
  }

  if (!list) return null;

  return (
    <Modal open={open} setOpen={onClose} title="Manage List">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{list.name}</h2>
        <h2 className="text-lg font-semibold">Description</h2>
        <div
          className="h-full w-full p-2 border border-gray-300 rounded-md"
          >
          {JSON.stringify(list.contents)}
        </div>
        <div className="flex justify-end gap-4">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onClickDelete(list.id)}
          >
            Delete List
          </Button>
          <Button size="sm">Save</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ManageListModal;
