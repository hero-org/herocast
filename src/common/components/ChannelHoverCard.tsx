import React, { useEffect, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useInView } from "react-intersection-observer";
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

const ChannelHoverCard = ({
  channelName,
  children,
  className,
}: ProfileHoverCardProps) => {
  const accountChannels = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]?.channels || []
  );
  const {
    addPinnedChannel,
    removePinnedChannel,
    allChannels,
    setSelectedChannelUrl,
  } = useAccountStore();
  const [channel, setChannel] = useState<ChannelType | undefined>();
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  });
  const isChannelPinned =
    channel && accountChannels.findIndex((c) => c.url === channel.url) !== -1;

  useEffect(() => {
    if (!inView) return;

    const findableName = channelName.replace("/", "").toLowerCase();
    const channel = allChannels.find(
      (c) => c.name.toLowerCase() === findableName
    );
    setChannel(channel);
  }, [inView]);

  const onClick = () => {
    if (!channel) return;

    setSelectedChannelUrl(channel?.url);
  };

  const onClickTogglePin = () => {
    if (!channel) return;

    if (isChannelPinned) {
      removePinnedChannel(channel);
    } else {
      addPinnedChannel(channel);
    }
  };

  const renderChannelContent = () => {
    if (!channel) return <Loading />;

    return (
      <div className="space-y-2">
        <div className="flex flex-row justify-between">
          <Avatar>
            <AvatarImage src={channel.icon_url} />
            <AvatarFallback>{channel.name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={() => onClick()}>
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onClickTogglePin()}
            >
              {isChannelPinned ? "Unpin" : "Pin"}
            </Button>
          </div>
        </div>
        <div>
          <h2 className="text-md font-semibold break-all overflow-x-hidden line-clamp-1">
            {channel.name}
          </h2>
        </div>
        <div className="flex flex-col pt-2 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">
              {formatLargeNumber(channel.data?.followerCount || 0)}&nbsp;
            </span>
            followers
          </p>
        </div>
        <p className="flex pt-2 pr-2 text-sm break-words overflow-x-hidden">
          {channel?.description}
        </p>
      </div>
    );
  };

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger
        onClick={onClick}
        ref={ref}
        className={`${className} text-left`}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        className="border border-gray-400 overflow-hidden cursor-pointer"
      >
        {renderChannelContent()}
      </HoverCardContent>
    </HoverCard>
  );
};

export default ChannelHoverCard;
