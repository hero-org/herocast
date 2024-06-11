import React, { useEffect } from "react";
import Modal from "./Modal";
import NewPostEntry from "./NewPostEntry";
import { useNewPostStore } from "@/stores/useNewPostStore";
import { CastRow, CastToReplyType } from "./CastRow";
import { useHotkeys } from "react-hotkeys-hook";
import { AccountSelector } from "./AccountSelector";
import { AccountStatusType } from "../constants/accounts";
import { CastModalView, useNavigationStore } from "@/stores/useNavigationStore";

type NewCastModalProps = {
  linkedCast?: CastToReplyType;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const findDraftIdForLinkedCast = (castModalView, drafts, linkedCast) => {
  if (!drafts.length) return -1;

  if (castModalView === CastModalView.Quote) {
    return drafts.findIndex(
      (draft) =>
        draft?.embeds?.length &&
        draft?.embeds?.[0]?.castId?.hash === linkedCast?.hash
    );
  } else if (castModalView === CastModalView.Reply) {
    return drafts.findIndex(
      (draft) =>
        draft.parentCastId && draft.parentCastId?.hash === linkedCast?.hash
    );
  } else {
    return drafts.findIndex(
      (draft) => !draft?.embeds?.length && !draft.parentCastId
    );
  }
};

const NewCastModal = ({ linkedCast, open, setOpen }: NewCastModalProps) => {
  const { castModalView } = useNavigationStore();
  const { addNewPostDraft, drafts, removePostDraft } = useNewPostStore();
  const draftIdx = findDraftIdForLinkedCast(castModalView, drafts, linkedCast);
  const draft = draftIdx !== -1 ? drafts[draftIdx] : undefined;

  useEffect(() => {
    if (draftIdx === -1 && open) {
      if (castModalView === CastModalView.New) {
        addNewPostDraft({});
      } else {
        const castObj = {
          hash: linkedCast.hash,
          fid: linkedCast.author.fid,
        };
        let options = {};
        if (castModalView === CastModalView.Quote) {
          options = { embeds: [{ castId: castObj }] };
        } else if (castModalView === CastModalView.Reply) {
          options = { parentCastId: castObj };
        }
        addNewPostDraft(options);
      }
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

  const getTitle = () => {
    let action = "New post";
    const username = `@${linkedCast?.author.username}`;
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
        {open && draftIdx !== -1 && (
          <div
            className="flex flex-col max-w-full max-h-[calc(100vh-200px)]"
            key={`new-post-parentHash-${linkedCast?.hash}`}
          >
            <div className="mb-4">
              {linkedCast && castModalView === CastModalView.Reply && (
                <CastRow cast={linkedCast} isSelected isEmbed />
              )}
            </div>
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
