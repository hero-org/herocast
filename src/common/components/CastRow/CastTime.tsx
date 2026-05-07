import { format, formatDistanceToNowStrict } from 'date-fns';
import type React from 'react';
import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CastTimeProps {
  timestamp?: string | number | Date | null;
}

export const CastTime: React.FC<CastTimeProps> = ({ timestamp }) => {
  const timeFormatting = useMemo(() => {
    if (!timestamp) return null;

    return {
      timeAgoStr: formatDistanceToNowStrict(new Date(timestamp), {
        addSuffix: false,
      }),
      fullTime: format(timestamp, 'PPP HH:mm'),
    };
  }, [timestamp]);

  if (!timeFormatting) return null;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger>
          <span className="text-sm leading-5 text-foreground/60 hover:underline">{timeFormatting.timeAgoStr}</span>
        </TooltipTrigger>
        <TooltipContent
          align={'center'}
          className="bg-popover border border-muted text-foreground/80 text-sm px-2 py-1"
          side="bottom"
        >
          {timeFormatting.fullTime}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
