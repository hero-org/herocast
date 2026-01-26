'use client';

import type { Channel } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { take } from 'lodash';
import {
  ArrowLeft,
  AtSign,
  DollarSign,
  Hash,
  Heart,
  Layers,
  LayoutGrid,
  List,
  MessageCircle,
  PenSquare,
  Repeat2,
  Search,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { FeedPanelConfig, InboxPanelConfig, PanelConfigUnion, PanelType } from '@/common/types/workspace.types';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useListStore } from '@/stores/useListStore';

interface AddPanelPlaceholderProps {
  onAddPanel: (type: PanelType, config: PanelConfigUnion) => void;
  disabled?: boolean;
}

type AddPanelStep = 'selecting' | 'picking-channel' | 'picking-list';

interface PanelOption {
  id: string;
  type: PanelType;
  label: string;
  icon: React.ReactNode;
  available: boolean;
  action: 'direct' | 'pick-channel' | 'pick-list';
  directConfig?: PanelConfigUnion;
}

const panelOptions: PanelOption[] = [
  {
    id: 'following',
    type: 'feed',
    label: 'Following',
    icon: <Layers className="h-5 w-5" />,
    available: true,
    action: 'direct',
    directConfig: { feedType: 'following' } as FeedPanelConfig,
  },
  {
    id: 'trending',
    type: 'feed',
    label: 'Trending',
    icon: <TrendingUp className="h-5 w-5" />,
    available: true,
    action: 'direct',
    directConfig: { feedType: 'trending' } as FeedPanelConfig,
  },
  {
    id: 'channel',
    type: 'feed',
    label: '/channel',
    icon: <Hash className="h-5 w-5" />,
    available: true,
    action: 'pick-channel',
  },
  {
    id: 'ticker',
    type: 'feed',
    label: '$ticker',
    icon: <DollarSign className="h-5 w-5" />,
    available: false, // Phase 2
    action: 'direct',
  },
  {
    id: 'replies',
    type: 'inbox',
    label: 'Replies',
    icon: <MessageCircle className="h-5 w-5" />,
    available: true,
    action: 'direct',
    directConfig: { tab: 'replies' } as InboxPanelConfig,
  },
  {
    id: 'mentions',
    type: 'inbox',
    label: 'Mentions',
    icon: <AtSign className="h-5 w-5" />,
    available: true,
    action: 'direct',
    directConfig: { tab: 'mentions' } as InboxPanelConfig,
  },
  {
    id: 'likes',
    type: 'inbox',
    label: 'Likes',
    icon: <Heart className="h-5 w-5" />,
    available: true,
    action: 'direct',
    directConfig: { tab: 'likes' } as InboxPanelConfig,
  },
  {
    id: 'recasts',
    type: 'inbox',
    label: 'Recasts',
    icon: <Repeat2 className="h-5 w-5" />,
    available: true,
    action: 'direct',
    directConfig: { tab: 'recasts' } as InboxPanelConfig,
  },
  {
    id: 'follows',
    type: 'inbox',
    label: 'Follows',
    icon: <UserPlus className="h-5 w-5" />,
    available: true,
    action: 'direct',
    directConfig: { tab: 'follows' } as InboxPanelConfig,
  },
  {
    id: 'lists',
    type: 'feed',
    label: 'Lists',
    icon: <List className="h-5 w-5" />,
    available: true,
    action: 'pick-list',
  },
  {
    id: 'compose',
    type: 'feed',
    label: 'Compose',
    icon: <PenSquare className="h-5 w-5" />,
    available: false, // Phase 2
    action: 'direct',
  },
  {
    id: 'miniapp',
    type: 'feed',
    label: 'Mini App',
    icon: <LayoutGrid className="h-5 w-5" />,
    available: false, // Phase 2
    action: 'direct',
  },
];

// Channel search API
const getChannels = async (query: string): Promise<Channel[]> => {
  if (query.length < 2) return [];
  try {
    const response = await fetch(`/api/channels/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return take(data?.channels ?? [], 10);
  } catch (e) {
    console.error(`Error searching channels: ${e}`);
    return [];
  }
};

// Channel Picker Step Component
interface ChannelPickerStepProps {
  onSelect: (channel: Channel) => void;
  onBack: () => void;
  disabled?: boolean;
}

const ChannelPickerStep: React.FC<ChannelPickerStepProps> = ({ onSelect, onBack, disabled }) => {
  const [query, setQuery] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setChannels([]);
      return;
    }

    const searchChannels = async () => {
      setIsLoading(true);
      try {
        const results = await getChannels(query);
        setChannels(results);
      } catch (error) {
        console.error('Failed to search channels:', error);
        setChannels([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchChannels, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} disabled={disabled} className="p-1 rounded hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h3 className="text-sm font-medium">Select Channel</h3>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search channels..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          autoFocus
          disabled={disabled}
        />
      </div>

      {/* Results */}
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 p-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : query.length < 2 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Type at least 2 characters to search</p>
        ) : channels.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No channels found for &quot;{query}&quot;</p>
        ) : (
          channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onSelect(channel)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg transition-colors',
                'hover:bg-muted cursor-pointer text-left'
              )}
            >
              {channel.image_url ? (
                <img src={channel.image_url} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <Hash className="h-3 w-3" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">/{channel.id}</span>
                {channel.name && channel.name !== channel.id && (
                  <span className="text-xs text-muted-foreground truncate">{channel.name}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

// List Picker Step Component
interface ListPickerStepProps {
  onSelect: (listId: string, listName: string, listType: 'search-list' | 'fid-list') => void;
  onBack: () => void;
  disabled?: boolean;
}

type ListTab = 'search' | 'users';

const ListPickerStep: React.FC<ListPickerStepProps> = ({ onSelect, onBack, disabled }) => {
  const [activeTab, setActiveTab] = useState<ListTab>('search');
  const searchLists = useListStore((state) => state.getSearchLists());
  const fidLists = useListStore((state) => state.getFidLists());

  const currentLists = activeTab === 'search' ? searchLists : fidLists;
  const listType = activeTab === 'search' ? 'search-list' : 'fid-list';

  return (
    <div className="flex flex-col gap-4">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} disabled={disabled} className="p-1 rounded hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h3 className="text-sm font-medium">Select List</h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setActiveTab('search')}
          disabled={disabled}
          className={cn(
            'flex-1 px-3 py-1.5 text-sm rounded-md transition-colors',
            activeTab === 'search'
              ? 'bg-background shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Search Lists
        </button>
        <button
          onClick={() => setActiveTab('users')}
          disabled={disabled}
          className={cn(
            'flex-1 px-3 py-1.5 text-sm rounded-md transition-colors',
            activeTab === 'users'
              ? 'bg-background shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          User Lists
        </button>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {currentLists.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No {activeTab === 'search' ? 'search' : 'user'} lists found.
            <br />
            Create one from the Lists page.
          </p>
        ) : (
          currentLists.map((list) => (
            <button
              key={list.id}
              onClick={() => onSelect(list.id, list.name, listType)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg transition-colors',
                'hover:bg-muted cursor-pointer text-left'
              )}
            >
              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                {activeTab === 'search' ? <Search className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
              </div>
              <span className="text-sm font-medium truncate">{list.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export const AddPanelPlaceholder: React.FC<AddPanelPlaceholderProps> = ({ onAddPanel, disabled = false }) => {
  const [step, setStep] = useState<AddPanelStep>('selecting');

  const handleSelectOption = useCallback(
    (option: PanelOption) => {
      if (disabled || !option.available) return;

      switch (option.action) {
        case 'direct':
          if (option.directConfig) {
            onAddPanel(option.type, option.directConfig);
          }
          break;
        case 'pick-channel':
          setStep('picking-channel');
          break;
        case 'pick-list':
          setStep('picking-list');
          break;
      }
    },
    [disabled, onAddPanel]
  );

  const handleChannelSelect = useCallback(
    (channel: Channel) => {
      const config: FeedPanelConfig = {
        feedType: 'channel',
        channelUrl: channel.parent_url || channel.url,
        channelName: channel.name || channel.id,
        channelImageUrl: channel.image_url,
      };
      onAddPanel('feed', config);
      setStep('selecting');
    },
    [onAddPanel]
  );

  const handleListSelect = useCallback(
    (listId: string, listName: string, listType: 'search-list' | 'fid-list') => {
      const config: FeedPanelConfig = {
        feedType: listType,
        listId,
        listName,
      };
      onAddPanel('feed', config);
      setStep('selecting');
    },
    [onAddPanel]
  );

  const handleBack = useCallback(() => {
    setStep('selecting');
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-muted/30 border-r border-border last:border-r-0">
      <div className="max-w-sm w-full space-y-6">
        {step === 'selecting' && (
          <>
            {/* Header */}
            <p className="text-center text-sm text-muted-foreground">
              Add parallel feeds to monitor multiple streams at once
            </p>

            {/* Panel options grid */}
            <div className="grid grid-cols-2 gap-2">
              {panelOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelectOption(option)}
                  disabled={disabled || !option.available}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-colors',
                    option.available && !disabled
                      ? 'border-border bg-background hover:bg-muted hover:border-foreground/20 cursor-pointer'
                      : 'border-border/50 bg-muted/20 opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="text-muted-foreground">{option.icon}</span>
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>

            {/* Hint */}
            <p className="text-center text-xs text-muted-foreground">Or type /new feed in command bar</p>
          </>
        )}

        {step === 'picking-channel' && (
          <ChannelPickerStep onSelect={handleChannelSelect} onBack={handleBack} disabled={disabled} />
        )}

        {step === 'picking-list' && (
          <ListPickerStep onSelect={handleListSelect} onBack={handleBack} disabled={disabled} />
        )}
      </div>
    </div>
  );
};

export default AddPanelPlaceholder;
