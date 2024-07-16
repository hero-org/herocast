import React, { useEffect, useMemo } from "react";
import Modal from "./Modal";
import NewPostEntry from "./NewPostEntry";
import { useDraftStore } from "@/stores/useDraftStore";
import { CastRow } from "./CastRow";
import { useHotkeys } from "react-hotkeys-hook";
import { AccountSelector } from "./AccountSelector";
import { AccountStatusType } from "../constants/accounts";
import { CastModalView, useNavigationStore } from "@/stores/useNavigationStore";
import { useDataStore } from "@/stores/useDataStore";
import { UUID } from "crypto";

type NewCastModalProps = {
  draftId: UUID;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const NewCastModal = ({ draftId, open, setOpen }: NewCastModalProps) => {
  const { castModalView } = useNavigationStore();
  const { selectedCast } = useDataStore();
  const { drafts, removePostDraftById } = useDraftStore();
  const draftIdx = useMemo(
    () => drafts.findIndex((draft) => draft.id === draftId),
    [draftId, drafts]
  );
  const draft = draftIdx !== undefined ? drafts[draftIdx] : undefined;

  useEffect(() => {
    if (!open && draftId !== undefined) {
      removePostDraftById(draftId);
    }
  }, [open, draftId]);
  useHotkeys("esc", () => setOpen(false), [open], {
    enableOnFormTags: true,
    enableOnContentEditable: true,
    enabled: open,
  });

  const getTitle = () => {
    let action = "New post";
    const username = `@${selectedCast?.author.username}`;
    if (castModalView === CastModalView.Reply) {
      action = `Reply to ${username}`;
    } else if (castModalView === CastModalView.Quote) {
      action = `Quote ${username}`;
    }
    return (
      <span className="flex items-center">
        {action} as
        <AccountSelector
          className="ml-2 w-1/2"
          accountFilter={(account) =>
            account.status === AccountStatusType.active
          }
        />
      </span>
    );
  };

  return (
    <Modal title={getTitle()} open={open} setOpen={setOpen}>
      <div className="mt-2 overflow-auto">
        {open && draftId !== undefined && (
          <div
            className="flex flex-col max-w-full max-h-[calc(100vh-200px)]"
            key={`new-post-parentHash-${selectedCast?.hash}`}
          >
            {selectedCast && castModalView === CastModalView.Reply && (
              <div className="mb-4 rounded-lg border border-foreground/10">
                <CastRow cast={selectedCast} isEmbed />
              </div>
            )}
            <div className="flex">
              <NewPostEntry
                draft={draft}
                draftIdx={draftIdx}
                onPost={() => {
                  setOpen(false);
                }}
                hideChannel={castModalView === CastModalView.Reply}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default NewCastModal;
