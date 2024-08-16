import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useAccountStore } from "@/stores/useAccountStore";
import { ChannelType } from "../constants/channels";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loading } from "./Loading";
import { Button } from "@/components/ui/button";
import { formatLargeNumber } from "../helpers/text";

type ProfileHoverCardProps = {
  channelName: string;
  children: React.ReactNode;
  className?: string;
};

const ChannelHoverCard = memo(({ channelName, children, className }: ProfileHoverCardProps) => {
  const accountChannels = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.channels || []);
  const { addPinnedChannel, removePinnedChannel, allChannels, setSelectedChannelUrl } = useAccountStore();
  const [channel, setChannel] = useState<ChannelType | undefined>();

  const foundChannel = useMemo(() => {
    const findableName = channelName.replace(/[-\s]\//g, "").toLowerCase();
    return allChannels.find((c) => c.name.toLowerCase() === findableName);
  }, [channelName, allChannels]);

  useEffect(() => {
    if (!foundChannel || foundChannel === channel) return;
    setChannel(foundChannel);
  }, [foundChannel, channel]);

  const isChannelPinned = useMemo(
    () => channel && accountChannels.findIndex((c) => c.url === channel.url) !== -1,
    [channel, accountChannels]
  );

  const onClick = useCallback(() => {
    if (!channel) return;
    setSelectedChannelUrl(channel?.url);
  }, [channel, setSelectedChannelUrl]);

  const onClickTogglePin = useCallback(() => {
    if (!channel) return;
    if (isChannelPinned) {
      removePinnedChannel(channel);
    } else {
      addPinnedChannel(channel);
    }
  }, [channel, isChannelPinned, removePinnedChannel, addPinnedChannel]);

  const renderChannelContent = useMemo(() => {
    if (!channel) return <Loading />;

    return (
      <div className="space-y-2">
        <div className="flex flex-row justify-between">
          <Avatar>
            <AvatarImage src={channel.icon_url} alt={channel.name} />
            <AvatarFallback>{channel.name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={onClick}>
              View
            </Button>
            <Button variant="outline" size="sm" onClick={onClickTogglePin}>
              {isChannelPinned ? "Unpin" : "Pin"}
            </Button>
          </div>
        </div>
        <div>
          <h2 className="text-md font-semibold break-all overflow-x-hidden line-clamp-1">{channel.name}</h2>
        </div>
        <div className="flex flex-col pt-2 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">
              {formatLargeNumber(channel.data?.followerCount || 0)}&nbsp;
            </span>
            followers
          </p>
        </div>
        {channel.description && (
          <p className="flex pt-2 pr-2 text-sm break-words overflow-x-hidden">{channel.description}</p>
        )}
      </div>
    );
  }, [channel, isChannelPinned, onClick, onClickTogglePin]);

  if (!channel) return children;

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger onClick={onClick} className={`${className} text-left`}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="bottom" className="border border-gray-400 overflow-hidden cursor-pointer">
        {renderChannelContent}
      </HoverCardContent>
    </HoverCard>
  );
});

ChannelHoverCard.displayName = "ChannelHoverCard";

export default ChannelHoverCard;
