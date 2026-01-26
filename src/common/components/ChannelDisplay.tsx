import type React from 'react';
import { useChannelLookup } from '@/common/hooks/useChannelLookup';
import { Badge } from '@/components/ui/badge';

interface ChannelDisplayProps {
  parentUrl?: string | null;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
}

export const ChannelDisplay: React.FC<ChannelDisplayProps> = ({
  parentUrl,
  className = 'w-fit text-xs',
  variant = 'outline',
}) => {
  const { channel, isLoading } = useChannelLookup(parentUrl || undefined);

  if (!parentUrl || !channel) return null;

  if (isLoading) {
    return (
      <Badge variant={variant} className={`${className} animate-pulse`}>
        Loading...
      </Badge>
    );
  }

  return (
    <Badge variant={variant} className={className}>
      {channel.name}
    </Badge>
  );
};
