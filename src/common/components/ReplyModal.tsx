import React, { useEffect } from 'react';
import Modal from './Modal';
import { CastType } from '../constants/farcaster';
import NewPostEntry from './NewPostEntry';
import { useNewPostStore } from '@/stores/useNewPostStore';
import { CastRow } from './CastRow';

type CastToReplyType = {
  hash: string;
  author: {
    fid: number;
    display_name?: string;
    displayName?: string;
  }
}

type ReplyModalProps = {
  parentCast: CastToReplyType;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const ReplyModal = ({ parentCast, open, setOpen }: ReplyModalProps) => {
  const {
    addNewPostDraft,
    removePostDraft
  } = useNewPostStore();

  const draftIdx = useNewPostStore(state => state.drafts && state.drafts.findIndex(draft => draft.parentCastId?.hash === parentCast?.hash));
  const { drafts } = useNewPostStore();
  const draft = draftIdx !== -1 ? drafts[draftIdx] : undefined;

  useEffect(() => {
    if (draftIdx === -1 && open) {
      addNewPostDraft({ parentCastId: { hash: parentCast?.hash, fid: parentCast?.author.fid } })
    }
    return () => {
      if (open) return;

      if (draftIdx !== -1) {
        removePostDraft(draftIdx);
      }
    }
  }, [draftIdx, open])

  return (
    <Modal
      title={`Reply to ${parentCast?.author.display_name || parentCast?.author.displayName}`}
      open={open}
      setOpen={setOpen}
    >
      <div className="mt-4">
        {open && draftIdx !== -1 && (
          <div
            className="mt-4"
            key={`new-post-parentHash-${parentCast?.hash}`}
          >
            <div className="mb-4">
              {parentCast && (
                <CastRow
                  cast={parentCast}
                  isSelected
                  disableEmbeds
                />
              )}
            </div>
            <div className="-ml-1">
            <NewPostEntry
              draft={draft}
              draftIdx={draftIdx}
              onPost={() => setOpen(false)}
              hideChannel
            />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
};

export default ReplyModal;
