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

const ChannelsOverview = () => {
  const { selectedChannelUrl, setSelectedChannelUrl, resetSelectedChannel } = useAccountStore();

  const { setSelectedListId } = useListStore();

  let channels: ChannelType[] = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.channels);
  const [isShowAllChannels, setIsShowAllChannels] = useState(false);
  if (!channels) channels = [];

  const onUpdateChannel = (url: string) => {
    setSelectedChannelUrl(url);
    setSelectedListId(undefined);
  };

  const renderCustomChannel = ({ name, url, icon }: { name: string; url: string; icon?: React.ReactNode }) => {
    return (
      <li key={`custom-channel-${name}`} className="px-2 lg:pr-4">
        <div
          onClick={() => onUpdateChannel(url)}
          className={cn(
            selectedChannelUrl === url ? 'text-foreground font-semibold' : 'text-foreground/70 hover:text-foreground',
            'flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer'
          )}
        >
          <span className="flex flex-nowrap truncate">
            {icon}
            {name}
          </span>
        </div>
      </li>
    );
  };

  const renderFeedHeader = (title: string | JSX.Element, button?) => {
    return (
      <div className="flex items-center px-2 py-1 sm:px-2">
        <h3 className="mr-2 text-md font-semibold leading-7 tracking-tight text-primary">{title}</h3>
        {button}
      </div>
    );
  };

  const renderChannel = (channel: ChannelType) => (
    <div
      onClick={() => onUpdateChannel(channel.url)}
      className={cn(
        selectedChannelUrl === channel.url
          ? 'text-foreground font-semibold'
          : 'text-foreground/70 hover:text-foreground',
        'flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer'
      )}
    >
      <div className="flex max-w-sm">
        {channel.icon_url && (
          <img
            src={channel.icon_url}
            alt=""
            className={cn(
              selectedChannelUrl === channel.url ? 'border-gray-100' : 'border-gray-400 hover:border-gray-300',
              'mr-1 mt-0.5 bg-gray-100 border h-5 w-5 flex-none rounded-full'
            )}
          />
        )}
        <span className="flex-nowrap truncate">{channel.name}</span>
      </div>
    </div>
  );

  const renderChannelList = () => (
    <div className="flex flex-col">
      <ul role="list" className="px-4 py-1 sm:px-4">
        <CollapsibleList
          items={channels}
          renderItem={(channel: ChannelType) => <li key={channel.name}>{renderChannel(channel)}</li>}
          isShowAll={isShowAllChannels}
          setIsShowAll={setIsShowAllChannels}
        />
      </ul>
    </div>
  );

  const renderAddFirstChannelsButton = () => (
    <Link href="/channels" className="px-4 py-3 sm:px-4 sm:py-3">
      <Button size="sm" className="mt-2">
        Pin your channels
      </Button>
    </Link>
  );

  const hasChannels = channels.length > 0;

  return (
    <div className="mb-4">
      <ul role="list" className="mb-4">
        {renderCustomChannel({
          name: 'Follow Feed',
          url: CUSTOM_CHANNELS.FOLLOWING,
          icon: (
            <HomeIcon className="border-gray-400 hover:border-gray-300 mr-1 mt-0.5 bg-foreground/10 border h-5 w-5 p-0.5 flex-none rounded-full" />
          ),
        })}
        {renderCustomChannel({
          name: 'Trending Feed',
          url: CUSTOM_CHANNELS.TRENDING,
          icon: (
            <ArrowTrendingUpIcon className="border-gray-400 hover:border-gray-300 mr-1 mt-0.5 bg-foreground/10 border h-5 w-5 p-0.5 flex-none rounded-full" />
          ),
        })}
      </ul>
      <Separator className="my-2" />
      {renderFeedHeader(
        <span className="flex">
          <RectangleGroupIcon className="mt-1 mr-1 h-5 w-5" aria-hidden="true" />
          Channels
        </span>
      )}
      <Link href="/channels">
        <Button variant="outline" className="h-6 px-2">
          Pin<span className="hidden ml-1 lg:block">channels</span>
        </Button>
      </Link>
      {hasChannels ? renderChannelList() : renderAddFirstChannelsButton()}
    </div>
  );
};

export default ChannelsOverview;
