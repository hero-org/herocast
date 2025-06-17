import { useDraftStore } from '@/stores/useDraftStore';
import React, { useEffect, useMemo, useState, useRef, Suspense } from 'react';
import { Loading } from '@/common/components/Loading';
import dynamic from 'next/dynamic';

// Dynamic import with loading fallback
const NewPostEntry = dynamic(() => import('@/common/components/Editor/NewCastEditor'), {
  loading: () => <Loading loadingMessage="Loading editor..." />,
  ssr: false,
});
import { ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { PencilSquareIcon } from '@heroicons/react/20/solid';
import DraftListItem from './components/DraftListItem';
import DraftList from './components/DraftList';
import { Button } from '@/components/ui/button';
import { CastRow } from '@/common/components/CastRow';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { useAccountStore } from '@/stores/useAccountStore';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { DraftStatus, DraftType } from '@/common/constants/farcaster';
import map from 'lodash.map';
import { renderEmbedForUrl } from '@/common/components/Embeds';
import { getUserLocaleDateFromIsoString, localize } from '@/common/helpers/date';
import { ChannelType } from '@/common/constants/channels';
import { UUID } from 'crypto';
import { usePathname, useSearchParams } from 'next/navigation';
import { SelectableListWithHotkeys } from '@/common/components/SelectableListWithHotkeys';
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

const getDraftsForTab = (drafts: DraftType[], activeTab: DraftListTab, activeAccountId?: UUID) => {
  switch (activeTab) {
    case DraftListTab.writing:
      return drafts.filter((draft) => draft.status === DraftStatus.writing || draft.status === DraftStatus.publishing);
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

const getChannelForParentUrl = ({ channels, parentUrl }: { channels: ChannelType[]; parentUrl: string | null }) =>
  parentUrl ? channels.find((channel) => channel.url === parentUrl) : undefined;

export default function NewPost() {
  const { drafts, addNewPostDraft, removePostDraftById, removeEmptyDrafts } = useDraftStore();
  const [parentCasts, setParentCasts] = useState<CastWithInteractions[]>([]);
  const { accounts, selectedAccountIdx, allChannels } = useAccountStore();
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
    if (searchParams.has('text')) {
      const text = searchParams.getAll('text').join('. ');

      if (text) {
        addNewPostDraft({ text });
      }
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

  useEffect(() => {
    const parentCastIds = drafts.map((draft) => draft?.parentCastId?.hash).filter(Boolean) as string[];

    const fetchParentCasts = async () => {
      const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
      const res = await neynarClient.fetchBulkCasts(parentCastIds, {
        viewerFid: Number(selectedAccount?.platformAccountId),
      });
      setParentCasts(res?.result?.casts || []);
    };
    if (parentCastIds.length > 0) {
      fetchParentCasts();
    }
  }, [drafts, selectedAccount?.platformAccountId]);

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
    addNewPostDraft({});
    setActiveTab(DraftListTab.writing);
  };

  const onRemove = (draft: DraftType) => {
    removePostDraftById(draft.id);
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
    if (!draft) return renderEmptyMainContent();

    const parentCast = parentCasts.find((cast) => cast.hash === draft.parentCastId?.hash);
    return (
      <div key={draft.id} className="pt-2 pb-6">
        {parentCast && <CastRow cast={parentCast} />}
        <NewPostEntry
          draft={draft}
          draftIdx={drafts.findIndex((d) => d.id === draft.id)}
          onPost={() => resetSelectedDraftId()}
        />
      </div>
    );
  };

  const renderScheduledDraft = (draft?: DraftType) => {
    if (!draft) return renderEmptyMainContent();

    const channel = getChannelForParentUrl({
      channels: allChannels,
      parentUrl: draft.parentUrl,
    });

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
          {channel && (
            <p>
              &nbsp;in&nbsp;
              <span className="h-5 inline-flex truncate items-top rounded-sm bg-blue-400/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
                {channel.name}
              </span>
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
          <div className="mt-8 rounded-md bg-muted p-2 w-full break-all">
            {map(draft.embeds, (embed: any) => (
              <div key={`cast-embed-${embed.url || embed.hash}`}>{renderEmbedForUrl(embed)}</div>
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
      return renderScrollableList(<div className="flex justify-center py-4">{renderNewDraftButton()}</div>);
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
          getChannelForParentUrl={getChannelForParentUrl}
          allChannels={allChannels}
        />
        <div className="mt-4 flex justify-center">{renderNewDraftButton()}</div>
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
        isActive={true}
        getChannelForParentUrl={getChannelForParentUrl}
        allChannels={allChannels}
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
      <div className="flex flex-col">
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

        <div className="flex-1 overflow-y-auto px-4 py-0 flex flex-col">{renderContent()}</div>
      </div>
      {/* The drafts modal should only be rendered on screens below XL */}
      {isBelowLgScreen && renderDraftsModal()}
    </div>
  );
}
