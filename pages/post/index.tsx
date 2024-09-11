import NewPostEntry from '@/common/components/Editor/NewCastEditor';
import { useDraftStore } from '@/stores/useDraftStore';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ClockIcon, TrashIcon } from '@heroicons/react/24/outline';
import { PencilSquareIcon } from '@heroicons/react/20/solid';
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
import UpgradeFreePlanCard from '@/common/components/UpgradeFreePlanCard';
import { getPlanLimitsForPlan } from '@/config/planLimits';
import newThread from './assets/plus-circle.png';  // Add newThread image import

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
        .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
    case DraftListTab.published:
      return drafts.filter((draft) => draft.status === DraftStatus.published && draft.accountId === activeAccountId);
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


  const [posts, setPosts] = useDraftStore([{ id: 1, content: '', threads: [] }]);
  const { allPosts, setAllPosts } = useDraftStore([]);

  const draftsForTab = useMemo(
    () => getDraftsForTab(drafts, activeTab, selectedAccount?.id),
    [drafts, activeTab, selectedAccount?.id]
  );
  const scheduledCastsCount = useMemo(
    () => getDraftsForTab(drafts, DraftListTab.scheduled).length,
    [drafts, selectedAccount?.id]
  );
  const [selectedDraftId, setSelectedDraftId] = useState(draftsForTab[0]?.id);

  const resetSelectedDraftId = () => {
    setSelectedDraftId(draftsForTab[0]?.id);
  };

  useEffect(() => {
    if (searchParams.has('text')) {
      const text = searchParams.getAll('text').join('. ');

      if (text) {
        addNewPostDraft({ text });
      }
    } else if (drafts.length === 0) {
      addNewPostDraft({});
    }
  }, [searchParams]);

  useEffect(() => {
    if (savedPathname.current !== pathname && drafts.length > 0) {
      removeEmptyDrafts();
    }
  }, [pathname, searchParams]);

  useEffect(() => {
   
    if (!draftsForTab.find((draft) => draft.id === selectedDraftId) && draftsForTab.length > 0) {
      setSelectedDraftId(draftsForTab[0]?.id);
    }
  }, [draftsForTab]);

  useEffect(() => {
    const parentCastIds = drafts.map((draft) => draft?.parentCastId?.hash).filter(Boolean) as unknown as string[];

    const fetchParentCasts = async () => {
      const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
      const res = await neynarClient.fetchBulkCasts(parentCastIds, {
        viewerFid: Number(selectedAccount?.platformAccountId),
      });
      setParentCasts(res?.result?.casts);
    };
    if (parentCastIds.length) {
      fetchParentCasts();
    }
  }, [drafts]);


  const handleContentChange = (event, postId) => {
    const newPosts = posts.map((post) => {
      if (post.id === postId) {
        return { ...post, content: event.target.value };
      }
      return post;
    });
    setPosts(newPosts);
  };

   // Function to add a new thread to a post
  const addThread = (postId: number) => {
    const newPosts = posts.map((post) => {
      if (post.id === postId) {
        return { ...post, threads: [...post.threads, ''] }; // Add new thread to the original post
      }
      return post;
    });
    setPosts(newPosts);
  };

   // Function to handle content change in a thread
  const handleThreadContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>, postId: number, index: number) => {
    const newPosts = posts.map((post) => {
      if (post.id === postId) {
        const newThreads = [...post.threads];
        newThreads[index] = event.target.value;
        return { ...post, threads: newThreads };
      }
      return post;
    });
    setPosts(newPosts);
  };


  const handlePostSubmit = () => {
    setAllPosts([...allPosts, ...posts]);
    setPosts([{ id: posts.length + 1, content: '', threads: [] }]);
  };

  const onRemove = (draft) => {
    removePostDraftById(draft.id);
  };

  const renderEmptyMainContent = () => (
    <div className="pt-2 pb-6 w-full min-h-[150px]">
      <div className="content-center px-2 py-1 rounded-lg w-full h-full min-h-[150px] border border-muted-foreground/20">
        {renderNewDraftButton()}
      </div>
    </div>
  );

  const renderWritingDraft = (draft) => {
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

  const renderNewDraftButton = () => (
    <div className="flex justify-center mt-6">
      <Button onClick={() => addNewPostDraft()} className="inline-flex items-center px-2 py-1">
        <PencilSquareIcon className="w-4 h-4 text-muted-foreground inline mr-2" />
        New Draft
      </Button>
    </div>
  );

  return (
    <div className="space-y-2 w-full">
      {/* Tabs for Draft Management */}
      <Tabs defaultValue={DraftListTab.writing} value={activeTab} onValueChange={(value) => setActiveTab(value)}>
        <TabsList>
          {DraftListTabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
              {tab.key === DraftListTab.scheduled && scheduledCastsCount > 0 ? (
                <Badge variant="secondary" className="ml-2 text-xxs w-4 h-4 p-0 rounded-full">
                  {scheduledCastsCount}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {DraftListTabs.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className={cn('relative w-full overflow-hidden mt-2')}>
            <ScrollArea className="h-full pb-24">
              {draftsForTab.map((draft) => (
                <div key={draft.id}>
                  <div className="w-full">
                    {renderWritingDraft(draft)}
                    <div className="flex justify-end px-2 mb-2 mt-2">
                      <Button onClick={() => onRemove(draft)} className="inline-flex items-center px-2 py-1">
                        <TrashIcon className="w-4 h-4 text-muted-foreground inline mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
      {/* Posts and Threads Management */}
      <div>
        {posts.map((post) => (
          <div key={post.id}>
            <textarea
              value={post.content}
              onChange={(event) => handleContentChange(event, post.id)}
              placeholder="Write a new post..."
              className="w-full border border-gray-300 rounded p-2"
            />
            <div>
              {post.threads.map((thread, index) => (
                <textarea
                  key={index}
                  value={thread}
                  onChange={(event) => handleThreadContentChange(event, post.id, index)}
                  placeholder="Write a thread..."
                  className="w-full border border-gray-300 rounded p-2 mt-2"
                />
              ))}
            </div>
            <button onClick={() => addThread(post.id)} className="mt-2 p-2 bg-blue-500 text-white rounded">
              <img src={newThread} alt="Add Thread" className="inline w-4 h-4 mr-1" />
              Add Thread
            </button>
          </div>
        ))}
        <button onClick={handlePostSubmit}>Submit</button>
      </div>
    </div>
  );
}
