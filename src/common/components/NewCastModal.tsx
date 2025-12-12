import React, { useEffect, useMemo, Suspense, Component, ReactNode } from 'react';
import Modal from '@/common/components/Modal';
import { Loading } from './Loading';
import dynamic from 'next/dynamic';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DraftStatus } from '@/common/constants/farcaster';

// Dynamic import with loading fallback
const NewPostEntry = dynamic(() => import('./Editor/NewCastEditor'), {
  loading: () => <Loading loadingMessage="Loading editor" />,
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

// Error Boundary for the Cast Editor
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class CastEditorErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Cast Editor Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
          <p className="text-sm text-foreground/60 mb-4">There was an error loading the editor. Please try again.</p>
          <p className="text-xs text-foreground/40 mb-4">{this.state.error?.message}</p>
          <Button onClick={this.handleReset} variant="outline" size="sm">
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

const NewCastModal: React.FC<NewCastModalProps> = ({ draftId, open, setOpen }) => {
  const { castModalView } = useNavigationStore();
  const { selectedCast } = useDataStore();
  const { drafts, removePostDraftById } = useDraftStore();
  const draft = useMemo(() => drafts.find((d) => d.id === draftId), [draftId, drafts]);

  useEffect(() => {
    // Add a small delay before removing draft to allow editor to finish any pending updates
    if (!open && draftId !== undefined) {
      const timeoutId = setTimeout(() => {
        const draft = drafts.find((d) => d.id === draftId);

        // Only delete if: no draft, empty content, or already published
        const isEmpty = !draft?.text?.trim() && !draft?.embeds?.length;
        const isPublished = draft?.status === DraftStatus.published;

        if (!draft || isEmpty || isPublished) {
          removePostDraftById(draftId);
        }
        // If draft has content, keep it (user can find it in /post page)
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [open, draftId, drafts, removePostDraftById]);
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
              <CastEditorErrorBoundary onReset={() => window.location.reload()}>
                {draft ? (
                  <NewPostEntry
                    draft={draft}
                    onPost={() => {
                      setOpen(false);
                    }}
                    hideChannel={castModalView === CastModalView.Reply}
                  />
                ) : (
                  <Loading loadingMessage="Loading draft..." />
                )}
              </CastEditorErrorBoundary>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default NewCastModal;
