import React, { useState } from 'react';
import { ChannelType } from '@/common/constants/channels';
import { CUSTOM_CHANNELS, useAccountStore } from '@/stores/useAccountStore';
import { SidebarHeader } from './SidebarHeader';
import { cn } from '@/lib/utils';
import { ArrowTrendingUpIcon, HomeIcon, RectangleGroupIcon } from '@heroicons/react/24/outline';
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

  const renderCustomChannel = ({ name, url, icon }: { name: string; url: string; icon?: React.ReactNode }) => {
    const isSelected = selectedChannelUrl === url;
    return (
      <li key={`custom-channel-${name}`} className="px-2 mx-2">
        <div
          onClick={() => onUpdateChannel(url)}
          className={cn(
            'flex items-center gap-x-3 rounded-lg px-4 py-2.5 text-sm font-medium cursor-pointer',
            isSelected 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'text-foreground/70 hover:text-foreground hover:bg-sidebar/40'
          )}
        >
          <span className="flex items-center gap-x-2 flex-nowrap truncate">
            {icon}
            <span className="font-medium">{name}</span>
          </span>
          {isSelected && (
            <div className="ml-auto w-2 h-2 bg-primary-foreground rounded-full" />
          )}
        </div>
      </li>
    );
  };

  const renderFeedHeader = (title: string | JSX.Element, button?) => {
    return (
      <div className="flex items-center justify-between px-4 py-2">
        <h3 className="text-sm font-semibold leading-6 text-foreground/90 flex items-center gap-x-2">{title}</h3>
        {button}
      </div>
    );
  };

  const renderChannel = (channel: ChannelType) => {
    const isSelected = selectedChannelUrl === channel.url;
    return (
      <div
        onClick={() => onUpdateChannel(channel.url)}
        className={cn(
          'flex items-center gap-x-3 rounded-lg mx-2 px-4 py-2.5 text-sm cursor-pointer',
          isSelected
            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
            : 'text-foreground/70 hover:text-foreground hover:bg-sidebar/40'
        )}
      >
        <div className="flex items-center gap-x-2 max-w-sm flex-1">
          {channel.icon_url && (
            <img
              src={channel.icon_url}
              alt=""
              className={cn(
                'h-5 w-5 flex-none rounded-full border transition-colors',
                isSelected 
                  ? 'border-primary-foreground/30 bg-primary-foreground/10' 
                  : 'border-sidebar-border bg-sidebar/20'
              )}
            />
          )}
          <span className="flex-nowrap truncate font-medium">{channel.name}</span>
        </div>
        {isSelected && (
          <div className="ml-auto w-2 h-2 bg-primary-foreground rounded-full" />
        )}
      </div>
    );
  };

  const renderChannelList = () => (
    <div className="flex flex-col space-y-1">
      <div className="py-2">
        <CollapsibleList
          items={channels}
          renderItem={(channel: ChannelType) => <div key={channel.name}>{renderChannel(channel)}</div>}
          isShowAll={isShowAllChannels}
          setIsShowAll={setIsShowAllChannels}
        />
      </div>
    </div>
  );

  const renderAddFirstChannelsButton = () => (
    <Link href="/channels" className="px-4 py-3">
      <Button size="sm" variant="outline" className="w-full border-dashed">
        Pin your first channel
      </Button>
    </Link>
  );

  const hasChannels = channels.length > 0;

  return (
    <div className="space-y-3">
      {/* Default Feeds */}
      <div className="space-y-1">
        <ul role="list" className="space-y-1">
          {renderCustomChannel({
            name: 'Follow Feed',
            url: CUSTOM_CHANNELS.FOLLOWING,
            icon: (
              <HomeIcon className="h-4 w-4 flex-none" />
            ),
          })}
          {renderCustomChannel({
            name: 'Trending Feed',
            url: CUSTOM_CHANNELS.TRENDING,
            icon: (
              <ArrowTrendingUpIcon className="h-4 w-4 flex-none" />
            ),
          })}
        </ul>
      </div>

      {/* Channels Section */}
      <div className="pt-2">
        <div className="border-t border-sidebar-border/30" />
        <div className="pt-3">
          {renderFeedHeader(
            <span className="flex items-center gap-x-2">
              <RectangleGroupIcon className="h-4 w-4" aria-hidden="true" />
              <span>Channels</span>
            </span>, 
            <Link href="/channels">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-sidebar/40">
                Pin
              </Button>
            </Link>
          )}
          {hasChannels ? renderChannelList() : renderAddFirstChannelsButton()}
        </div>
      </div>
    </div>
  );
};

export default ChannelsOverview;
