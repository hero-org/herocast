import React, { useEffect } from "react";
import Modal from "./Modal";
import NewPostEntry from "./NewPostEntry";
import { useNewPostStore } from "@/stores/useNewPostStore";
import { CastRow, CastToReplyType } from "./CastRow";
import { useHotkeys } from "react-hotkeys-hook";
import { useAccountStore } from "@/stores/useAccountStore";
import { AccountSelector } from "./AccountSelector";
import { AccountStatusType } from "../constants/accounts";

type ReplyModalProps = {
  parentCast: CastToReplyType;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const ReplyModal = ({ parentCast, open, setOpen }: ReplyModalProps) => {
  const { addNewPostDraft, removePostDraft } = useNewPostStore();

  const account = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]
  );

  const draftIdx = useNewPostStore(
    (state) =>
      state.drafts &&
      state.drafts.findIndex(
        (draft) => draft.parentCastId?.hash === parentCast?.hash
      )
  );
  const { drafts } = useNewPostStore();
  const draft = draftIdx !== -1 ? drafts[draftIdx] : undefined;

  useEffect(() => {
    if (draftIdx === -1 && open) {
      addNewPostDraft({
        parentCastId: {
          hash: parentCast?.hash,
          fid: parentCast?.author.fid.toString(),
        },
      });
    }
    return () => {
      if (open) return;

      if (draftIdx !== -1) {
        removePostDraft(draftIdx);
      }
    };
  }, [draftIdx, open]);

  useHotkeys("esc", () => setOpen(false), [open], {
    enableOnFormTags: true,
    enableOnContentEditable: true,
    enabled: open,
  });

  const getTitle = () => (
    <span className="flex items-center">
      Reply to $
      {parentCast?.author.display_name || parentCast?.author.displayName} as
      <AccountSelector
        className="ml-2 w-1/2"
        accountFilter={(account) => account.status === AccountStatusType.active}
      />
    </span>
  );

  return (
    <Modal title={getTitle()} open={open} setOpen={setOpen}>
      <div className="mt-2 overflow-auto">
        {open && draftIdx !== -1 && (
          <div
            className="flex flex-col max-w-full max-h-[calc(100vh-200px)]"
            key={`new-post-parentHash-${parentCast?.hash}`}
          >
            <div className="mb-4">
              {parentCast && (
                <CastRow cast={parentCast} isSelected disableEmbeds />
              )}
            </div>
            <div className="flex">
              <NewPostEntry
                draft={draft}
                draftIdx={draftIdx}
                onPost={() => {
                  setOpen(false);
                }}
                hideChannel
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ReplyModal;
