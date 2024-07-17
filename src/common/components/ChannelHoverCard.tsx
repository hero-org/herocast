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
  const { allChannels, setSelectedChannelUrl } = useAccountStore();
  const [channel, setChannel] = useState<ChannelType | undefined>();
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  });

  useEffect(() => {
    if (!inView) return;

    const findableName = channelName.replace("/", "").toLowerCase();
    const channel = allChannels.find(
      (c) => c.name.toLowerCase() === findableName
    );
    setChannel(channel);
  }, [inView]);

  const onClick = () => {
    setSelectedChannelUrl(channel?.url);
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
        {channel ? (
          <div className="space-y-2">
            <div className="flex flex-row justify-between">
              <Avatar>
                <AvatarImage src={channel.icon_url} />
                <AvatarFallback>{channel.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm" onClick={() => onClick()}>
                View
              </Button>
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
            <p className="flex pt-2 text-sm break-words pr-4 overflow-x-hidden">
              {channel?.description}
            </p>
          </div>
        ) : (
          <Loading />
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

export default ChannelHoverCard;
