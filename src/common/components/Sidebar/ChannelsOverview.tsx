import React, { useState } from 'react';
import { ChannelType } from '@/common/constants/channels';
import { CUSTOM_CHANNELS, useAccountStore } from '@/stores/useAccountStore';
import { SidebarHeader } from './SidebarHeader';
import { cn } from '@/lib/utils';
import { ArrowTrendingUpIcon, HomeIcon } from '@heroicons/react/24/outline';
import { Rss, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useListStore } from '@/stores/useListStore';
import { Separator } from '@/components/ui/separator';
import SidebarCollapsibleHeader from './SidebarCollapsibleHeader';
import CollapsibleList from './CollapsibleList';

type ChannelsOverviewProps = {
  onItemClick?: () => void;
};

const ChannelsOverview = ({ onItemClick }: ChannelsOverviewProps) => {
  const { selectedChannelUrl, setSelectedChannelUrl, resetSelectedChannel } = useAccountStore();

  const { setSelectedListId } = useListStore();

  let channels: ChannelType[] = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.channels);
  const [isShowAllChannels, setIsShowAllChannels] = useState(false);
  if (!channels) channels = [];

  const onUpdateChannel = (url: string) => {
    setSelectedChannelUrl(url);
    setSelectedListId(undefined);
    if (onItemClick) onItemClick();
  };

  const renderCustomChannel = ({
    name,
    url,
    icon,
    hotkey,
  }: {
    name: string;
    url: string;
    icon?: React.ReactNode;
    hotkey?: string;
  }) => {
    const isSelected = selectedChannelUrl === url;
    return (
      <li key={`custom-channel-${name}`} className="relative">
        {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
        <div
          onClick={() => onUpdateChannel(url)}
          className={cn(
            'flex items-center gap-x-3 rounded-lg mx-1 px-3 py-1.5 text-sm font-medium cursor-pointer group',
            isSelected
              ? 'bg-primary/20 text-foreground font-semibold'
              : 'text-foreground/70 hover:text-foreground hover:bg-sidebar/40'
          )}
        >
          <span className="flex items-center gap-x-2 flex-nowrap truncate">
            {icon}
            <span className="font-medium">{name}</span>
          </span>

          <div className="ml-auto flex items-center gap-x-2">
            {hotkey && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded font-medium text-md transition-all',
                  isSelected
                    ? 'bg-primary text-primary-foreground opacity-80'
                    : 'bg-muted/50 text-muted-foreground opacity-50 group-hover:opacity-100'
                )}
              >
                {hotkey}
              </span>
            )}
          </div>
        </div>
      </li>
    );
  };

  const renderFeedHeader = (title: string | JSX.Element) => {
    return (
      <div className="px-3 pb-1">
        <h3>{title}</h3>
      </div>
    );
  };

  const renderChannel = (channel: ChannelType) => {
    const isSelected = selectedChannelUrl === channel.url;
    return (
      <div className="relative">
        {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
        <div
          onClick={() => onUpdateChannel(channel.url)}
          className={cn(
            'flex items-center gap-x-3 rounded-lg mx-1 px-3 py-1.5 text-sm cursor-pointer',
            isSelected
              ? 'bg-primary/20 text-foreground font-semibold'
              : 'text-foreground/70 hover:text-foreground hover:bg-sidebar/40'
          )}
        >
          <div className="flex items-center gap-x-2 max-w-sm flex-1">
            {channel.icon_url && (
              <img
                src={channel.icon_url}
                alt=""
                className="h-4 w-4 flex-none rounded-full border border-sidebar-border/50"
              />
            )}
            <span className="flex-nowrap truncate font-medium">{channel.name}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderChannelList = () => (
    <div className="flex flex-col space-y-0.5">
      <div className="py-1">
        <CollapsibleList
          items={channels}
          renderItem={(channel: ChannelType) => <div key={channel.name}>{renderChannel(channel)}</div>}
          isShowAll={isShowAllChannels}
          setIsShowAll={setIsShowAllChannels}
          footer={
            <Link href="/channels" className="flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                + Pin
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  );

  const renderAddFirstChannelsButton = () => (
    <Link href="/channels" className="px-3 py-1">
      <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-muted-foreground hover:text-foreground">
        + Add
      </Button>
    </Link>
  );

  const hasChannels = channels.length > 0;

  return (
    <div className="space-y-4">
      {/* Feeds Section */}
      <div>
        {renderFeedHeader(
          <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
            <Rss className="h-3 w-3" />
            Feeds
          </span>
        )}
        <div className="space-y-0.5">
          <ul role="list" className="space-y-0.5">
            {renderCustomChannel({
              name: 'Follow Feed',
              url: CUSTOM_CHANNELS.FOLLOWING,
              icon: <HomeIcon className="h-4 w-4 flex-none" />,
              hotkey: '⇧0',
            })}
            {renderCustomChannel({
              name: 'Trending Feed',
              url: CUSTOM_CHANNELS.TRENDING,
              icon: <ArrowTrendingUpIcon className="h-4 w-4 flex-none" />,
              hotkey: '⇧1',
            })}
          </ul>
        </div>
      </div>

      {/* My Channels Section */}
      <div>
        <div className="border-t border-sidebar-border/20 mb-3" />
        {renderFeedHeader(
          <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
            <Hash className="h-3 w-3" />
            My Channels
          </span>
        )}
        {hasChannels ? renderChannelList() : renderAddFirstChannelsButton()}
      </div>
    </div>
  );
};

export default ChannelsOverview;
