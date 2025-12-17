'use client';

import { useDraftStore } from '@/stores/useDraftStore';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Loading } from '@/common/components/Loading';
import dynamic from 'next/dynamic';

// Dynamic imports with loading fallback
const ThreadComposer = dynamic(() => import('@/common/components/ThreadComposer'), {
  loading: () => <Loading loadingMessage="Loading thread composer" />,
  ssr: false,
});
import { ClockIcon } from '@heroicons/react/24/outline';
import { PencilSquareIcon } from '@heroicons/react/20/solid';
import DraftList from './components/DraftList';
import { Button } from '@/components/ui/button';
import { CastRow } from '@/common/components/CastRow';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { useAccountStore } from '@/stores/useAccountStore';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DraftStatus, DraftType } from '@/common/constants/farcaster';
import map from 'lodash.map';
import { renderEmbedForUrl } from '@/common/components/Embeds';
import { getUserLocaleDateFromIsoString } from '@/common/helpers/date';
import { ChannelDisplay } from '@/common/components/ChannelDisplay';
import { useSearchParams, usePathname } from 'next/navigation';
import EmptyStateWithAction from '@/common/components/EmptyStateWithAction';
import UpgradeFreePlanCard from '@/common/components/UpgradeFreePlanCard';
import { getPlanLimitsForPlan } from '@/config/planLimits';
import Modal from '@/common/components/Modal';
import { useMediaQuery } from '@/common/hooks/useMediaQuery';

enum DraftListTab {
  writing = 'writing',
  scheduled = 'scheduled',
  published = 'published',
}

const DraftListTabs = [
  {
    key: DraftListTab.writing,
    label: 'Writing',
  },
  {
    key: DraftListTab.scheduled,
    label: 'Scheduled',
  },
  {
    key: DraftListTab.published,
    label: 'Published',
  },
];

const getDraftsForTab = (drafts: DraftType[], activeTab: DraftListTab, activeAccountId?: string) => {
  switch (activeTab) {
    case DraftListTab.writing: {
      // Filter to writing/publishing status, then deduplicate by threadId (show first post of each thread)
      const writingDrafts = drafts.filter(
        (draft) => draft.status === DraftStatus.writing || draft.status === DraftStatus.publishing
      );
      const seenThreadIds = new Set<string>();
      return writingDrafts.filter((draft) => {
        if (!draft.threadId) return true; // Keep drafts without threadId
        if (seenThreadIds.has(draft.threadId)) return false; // Skip duplicates
        seenThreadIds.add(draft.threadId);
        return true;
      });
    }
    case DraftListTab.scheduled:
      return drafts
        .filter(
          (draft) => (!activeAccountId || draft.accountId === activeAccountId) && draft.status === DraftStatus.scheduled
        )
        .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()); // Soonest first
    case DraftListTab.published:
      return drafts
        .filter((draft) => draft.status === DraftStatus.published && draft.accountId === activeAccountId)
        .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()); // Most recent first
    default:
      return drafts;
  }
};

export default function NewPost() {
  const { drafts, addNewPostDraft, removePostDraftById, removeEmptyDrafts, getThreadDrafts } = useDraftStore();
  const [parentCasts, setParentCasts] = useState<CastWithInteractions[]>([]);
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];
  const [activeTab, setActiveTab] = useState<DraftListTab>(DraftListTab.writing);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const savedPathname = useRef(pathname);

  // 1024px is the default starting breakpoint for  tailwindcss' XL screen. This should be updated if the breakpoint values is updated in tailwind.config.js
  const isBelowLgScreen = useMediaQuery('(max-width: 1024px)');

  const { isDraftsModalOpen, openDraftsModal, closeDraftsModal } = useDraftStore();

  const draftsForTab = useMemo(
    () => getDraftsForTab(drafts, activeTab, selectedAccount?.id),
    [drafts, activeTab, selectedAccount?.id]
  );
  const scheduledCastsCount = useMemo(
    () => getDraftsForTab(drafts, DraftListTab.scheduled).length,
    [drafts, selectedAccount?.id]
  );
  const [selectedDraftId, setSelectedDraftId] = useState<string | undefined>(draftsForTab[0]?.id);
  const [selectedDraftIndex, setSelectedDraftIndex] = useState(0);
  const resetSelectedDraftId = () => {
    setSelectedDraftId(draftsForTab[0]?.id);
  };

  // Keep selectedIndex in sync with selectedDraftId
  useEffect(() => {
    if (draftsForTab.length > 0 && selectedDraftId) {
      const index = draftsForTab.findIndex((draft) => draft.id === selectedDraftId);
      if (index !== -1) {
        setSelectedDraftIndex(index);
      } else if (draftsForTab.length > 0) {
        // If selected draft is not in current tab, reset to first item
        setSelectedDraftIndex(0);
        setSelectedDraftId(draftsForTab[0]?.id);
      }
    }
  }, [draftsForTab, selectedDraftId, activeTab]);

  useEffect(() => {
    // if the modal is opened, and the screen is resized to XL (>=1280px), close the modal. This will prevent the modal from automatically opening when the screen back to <1280px
    if (!isBelowLgScreen && isDraftsModalOpen) {
      closeDraftsModal();
    }
  }, [isBelowLgScreen, isDraftsModalOpen, closeDraftsModal]);

  useEffect(() => {
    const text = searchParams.get('text');
    if (text) {
      addNewPostDraft({ text: text });
    }
    // Removed automatic draft creation when drafts.length === 0
  }, [searchParams, addNewPostDraft]);

  useEffect(() => {
    if (savedPathname.current !== pathname && drafts.length > 0) {
      removeEmptyDrafts();
    }
  }, [pathname, searchParams, drafts.length, removeEmptyDrafts]);

  useEffect(() => {
    // when drafts change, we want to make sure that selectedDraftId is always a valid draft id
    if (!draftsForTab.find((draft) => draft.id === selectedDraftId) && draftsForTab.length > 0) {
      setSelectedDraftId(draftsForTab[0]?.id);
    }
  }, [draftsForTab, selectedDraftId]);

  // Memoize parentCastIds - only recomputes when drafts change
  const parentCastIds = useMemo(
    () => drafts.map((draft) => draft?.parentCastId?.hash).filter(Boolean) as string[],
    [drafts]
  );

  // Create a stable string key for the effect dependency
  // This only changes when the actual hash values change, not on every drafts reference change
  const parentCastIdsKey = useMemo(() => parentCastIds.join(','), [parentCastIds]);

  useEffect(() => {
    if (parentCastIds.length === 0) return;

    const fetchParentCasts = async () => {
      const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
      const res = await neynarClient.fetchBulkCasts(parentCastIds, {
        viewerFid: Number(selectedAccount?.platformAccountId),
      });
      setParentCasts(res?.result?.casts || []);
    };

    fetchParentCasts();
  }, [parentCastIdsKey, selectedAccount?.platformAccountId]);

  const renderContent = () => {
    const draft = draftsForTab.find((draft) => draft.id === selectedDraftId);
    switch (activeTab) {
      case DraftListTab.writing:
        return renderWritingDraft(draft);
      case DraftListTab.scheduled:
      case DraftListTab.published:
        return renderScheduledDraft(draft);
      default:
        return null;
    }
  };

  const handleNewDraft = () => {
    addNewPostDraft({
      onSuccess: (draftId, threadId) => {
        setSelectedDraftId(draftId);
        setActiveTab(DraftListTab.writing);
      },
    });
  };

  const onRemove = (draft: DraftType) => {
    // Remove entire thread, not just the single draft
    if (draft.threadId) {
      const threadDrafts = getThreadDrafts(draft.threadId);
      threadDrafts.forEach((d) => removePostDraftById(d.id));
    } else {
      removePostDraftById(draft.id);
    }
  };

  const onDuplicate = (draft: DraftType) => {
    // Create a new draft with the same content
    addNewPostDraft({
      text: draft.text,
      parentUrl: draft.parentUrl,
      embeds: draft.embeds,
      onSuccess: (newDraftId, newThreadId) => {
        // Switch to writing tab and select the new draft
        setActiveTab(DraftListTab.writing);
        setSelectedDraftId(newDraftId);
      },
    });
  };

  const renderNewDraftButton = () => (
    <Button
      variant="outline"
      className="flex items-center gap-2 hover:bg-muted/80 transition-colors"
      onClick={handleNewDraft}
    >
      <PencilSquareIcon className="w-5 h-5" />
      <span>New draft</span>
    </Button>
  );

  const renderDraftActions = () => <div className="flex items-center gap-2">{renderNewDraftButton()}</div>;

  const renderEmptyMainContent = () => (
    <div className="flex flex-col items-center justify-center pt-2 pb-6 w-full h-full min-h-[400px]">
      <div
        onClick={() => handleNewDraft()}
        className="cursor-pointer flex flex-col items-center justify-center gap-4 p-8 rounded-lg w-full max-w-[500px] border border-muted"
      >
        <div className="flex flex-col items-center text-center gap-2">
          <PencilSquareIcon className="w-12 h-12 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold">New draft</h2>
          <p className="text-muted-foreground max-w-[350px]">
            Start writing your thoughts or schedule posts for later.
          </p>
        </div>
        <Button className="mt-2" onClick={handleNewDraft}>
          <PencilSquareIcon className="w-5 h-5 mr-2" />
          New draft
        </Button>
      </div>
    </div>
  );

  const renderWritingDraft = (draft?: DraftType) => {
    if (!draft || !draft.threadId) return renderEmptyMainContent();

    const parentCast = parentCasts.find((cast) => cast.hash === draft.parentCastId?.hash);

    return (
      <div className="h-full min-h-0 flex flex-col">
        <ThreadComposer
          threadId={draft.threadId}
          parentCast={parentCast}
          onPublishSuccess={() => resetSelectedDraftId()}
        />
      </div>
    );
  };

  const renderScheduledDraft = (draft?: DraftType) => {
    if (!draft) return renderEmptyMainContent();

    const parentCast = parentCasts.find((cast) => cast.hash === draft.parentCastId?.hash);
    const hasEmbeds = draft?.embeds?.length > 0;
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-center text-xs text-muted-foreground">
          <ClockIcon className="w-5 h-5" />
          <span className="ml-1">
            Scheduled for {getUserLocaleDateFromIsoString(draft.scheduledFor)}{' '}
            {draft.publishedAt && `· Published at ${getUserLocaleDateFromIsoString(draft.publishedAt)}`}
          </span>
          {draft.parentUrl && (
            <p className="flex items-center">
              &nbsp;in&nbsp;
              <ChannelDisplay
                parentUrl={draft.parentUrl}
                variant="secondary"
                className="h-5 inline-flex truncate items-top rounded-sm bg-blue-400/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30"
              />
            </p>
          )}
        </div>
        {parentCast && (
          <div className="flex border p-2 mt-2">{<CastRow cast={parentCast} isEmbed hideReactions />}</div>
        )}
        <div className="mt-4 px-2 py-1 bg-muted border rounded-lg w-full h-full min-h-[60px] max-h-[150px]">
          {draft.text}
        </div>
        {hasEmbeds && (
          <div className="flex flex-col md:flex-row items-center mt-4 w-full gap-2 flex-wrap">
            {map(draft.embeds, (embed: any, idx: number) => (
              <div className="max-w-xl rounded-md border border-foreground/10" key={`embed-preview-${idx}`}>
                {renderEmbedForUrl({
                  url: embed.url,
                  cast_id: embed.cast_id ?? undefined,
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTabsSelector = () => (
    <div className="flex items-center justify-between">
      <div className="flex items-center py-2 w-full">
        <TabsList className="flex w-full">
          {DraftListTabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="text-zinc-600 dark:text-zinc-200">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </div>
  );

  const renderScrollableList = (children: React.ReactElement) => (
    <ScrollArea
      className="flex-1 overflow-y-auto"
      style={{ maxHeight: isBelowLgScreen ? '350px' : 'calc(100vh - 200px)' }}
    >
      <div className="flex flex-col gap-2 pt-0 pb-4">{children}</div>
    </ScrollArea>
  );

  const renderDraftList = () => {
    if (draftsForTab.length === 0) {
      return renderScrollableList(<div className="flex justify-center py-4">{renderDraftActions()}</div>);
    }

    return renderScrollableList(
      <>
        <DraftList
          drafts={draftsForTab}
          selectedIdx={selectedDraftIndex}
          setSelectedIdx={setSelectedDraftIndex}
          setSelectedDraftId={setSelectedDraftId}
          onRemove={onRemove}
          isActive={activeTab === DraftListTab.writing}
        />
      </>
    );
  };

  const renderScheduledList = () => {
    if (draftsForTab.length === 0) {
      return (
        <EmptyStateWithAction
          title={activeTab === DraftListTab.scheduled ? 'No scheduled drafts' : 'No published drafts'}
          description={
            activeTab === DraftListTab.scheduled
              ? 'Schedule your drafts to be published at a specific time.'
              : 'Your published drafts will appear here.'
          }
          submitText="New draft"
          onClick={handleNewDraft}
          hideButton
        />
      );
    }

    return renderScrollableList(
      <DraftList
        drafts={draftsForTab}
        selectedIdx={selectedDraftIndex}
        setSelectedIdx={setSelectedDraftIndex}
        setSelectedDraftId={setSelectedDraftId}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        isActive={true}
      />
    );
  };
  const renderFreePlanCard = () => {
    const scheduledCastLimit = getPlanLimitsForPlan('openSource').maxScheduledCasts;
    if (scheduledCastsCount < scheduledCastLimit) return null;

    return <UpgradeFreePlanCard limitKey="maxScheduledCasts" />;
  };

  // The drafts modal to be rendered on screens below XL
  const renderDraftsModal = () => {
    return (
      <Modal
        title="Drafts"
        open={isDraftsModalOpen}
        setOpen={(isOpen) => (isOpen ? openDraftsModal() : closeDraftsModal())}
        focusMode={false}
      >
        <div className="mt-2 overflow-auto">
          {isDraftsModalOpen && (
            <div className="flex flex-col max-w-full">
              <div className="space-y-4">
                <Tabs
                  defaultValue="drafts"
                  className="w-full"
                  value={activeTab}
                  onValueChange={(value) => setActiveTab(value as DraftListTab)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center py-2 w-full">
                      <TabsList className="flex w-full">
                        {DraftListTabs.map((tab) => (
                          <TabsTrigger key={tab.key} value={tab.key} className="text-zinc-600 dark:text-zinc-200">
                            {tab.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                  </div>
                  <TabsContent value={DraftListTab.writing} className="overflow-hidden">
                    {renderFreePlanCard()}
                    {renderDraftList()}
                  </TabsContent>
                  <TabsContent value={DraftListTab.scheduled} className="overflow-hidden">
                    {renderFreePlanCard()}
                    {renderScheduledList()}
                  </TabsContent>
                  <TabsContent value={DraftListTab.published}>{renderScheduledList()}</TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </Modal>
    );
  };

  return (
    //two colums on XL screen and above, one column on screens below xl, because at this breakpoints, the dratft components becomes a modal
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] h-screen w-full">
      {/* Only render this on the side on xl screens */}
      {!isBelowLgScreen && (
        <div className="w-full overflow-y-auto p-4 border-r">
          <div className="space-y-4">
            <Tabs
              defaultValue="drafts"
              className="w-full"
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as DraftListTab)}
            >
              {renderTabsSelector()}
              <TabsContent value={DraftListTab.writing}>
                {renderFreePlanCard()}
                {renderDraftList()}
              </TabsContent>
              <TabsContent value={DraftListTab.scheduled}>
                {renderFreePlanCard()}
                {renderScheduledList()}
              </TabsContent>
              <TabsContent value={DraftListTab.published}>{renderScheduledList()}</TabsContent>
            </Tabs>
          </div>
        </div>
      )}
      <div className="flex flex-col h-full min-h-0">
        {/* This triggers the drafts modal. Should only be rendered on screens below XL */}
        {isBelowLgScreen && (
          <div className="p-4 pb-0 block xl:hidden">
            <div className="flex justify-between items-center">
              <Button className="inline-flex items-center gap-2" onClick={openDraftsModal}>
                <PencilSquareIcon className="w-5 h-5" />
                <span>Drafts</span>
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 px-4 py-0 flex flex-col">{renderContent()}</div>
      </div>
      {/* The drafts modal should only be rendered on screens below XL */}
      {isBelowLgScreen && renderDraftsModal()}
    </div>
  );
}
