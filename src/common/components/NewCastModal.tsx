import React, { useEffect, useMemo, Suspense } from 'react';
import Modal from '@/common/components/Modal';
import { Loading } from './Loading';
import dynamic from 'next/dynamic';

// Dynamic import with loading fallback
const NewPostEntry = dynamic(() => import('./Editor/NewCastEditor'), {
  loading: () => <Loading loadingMessage="Loading editor..." />,
  ssr: false,
});
import { useDraftStore } from '@/stores/useDraftStore';
import { CastRow } from './CastRow';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { AccountSelector } from './AccountSelector';
import { AccountStatusType } from '../constants/accounts';
import { CastModalView, useNavigationStore } from '@/stores/useNavigationStore';
import { useDataStore } from '@/stores/useDataStore';
import { UUID } from 'crypto';

type NewCastModalProps = {
  draftId: UUID;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const NewCastModal: React.FC<NewCastModalProps> = ({ draftId, open, setOpen }) => {
  const { castModalView } = useNavigationStore();
  const { selectedCast } = useDataStore();
  const { drafts, removePostDraftById } = useDraftStore();
  const draftIdx = useMemo(() => drafts.findIndex((draft) => draft.id === draftId), [draftId, drafts]);
  const draft = draftIdx !== -1 ? drafts[draftIdx] : undefined;

  useEffect(() => {
    if (!open && draftId !== undefined) {
      removePostDraftById(draftId);
    }
  }, [open, draftId]);
  useAppHotkeys(
    'esc',
    () => setOpen(false),
    {
      scopes: [HotkeyScopes.MODAL],
      enableOnFormTags: true,
      enableOnContentEditable: true,
      enabled: open,
    },
    [open, setOpen]
  );

  const getTitle = () => {
    let action = 'New post';
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
          accountFilter={(account) => account.status === AccountStatusType.active}
        />
      </span>
    );
  };

  return (
    <Modal title={getTitle()} open={open} setOpen={setOpen} focusMode={false}>
      <div className="mt-2 overflow-auto">
        {open && draftId !== undefined && (
          <div
            className="flex flex-col max-w-full max-h-[calc(100vh-200px)]"
            key={`new-post-parentHash-${selectedCast?.hash}`}
          >
            {selectedCast && castModalView === CastModalView.Reply && (
              <div className="mb-4 rounded-lg border border-foreground/10">
                <CastRow cast={selectedCast} isEmbed hideReactions />
              </div>
            )}
            <div className="flex">
              {draft && draftIdx !== -1 ? (
                <NewPostEntry
                  draft={draft}
                  draftIdx={draftIdx}
                  onPost={() => {
                    setOpen(false);
                  }}
                  hideChannel={castModalView === CastModalView.Reply}
                />
              ) : (
                <Loading loadingMessage="Loading draft..." />
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default NewCastModal;
