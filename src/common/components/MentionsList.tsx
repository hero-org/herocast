'use client';

import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { FarcasterMention } from '@mod-protocol/farcaster';
import { cn } from '@/lib/utils';
import { useIsMounted } from '../helpers/hooks';

type MentionListRef = {
  onKeyDown: (props: { event: Event }) => boolean;
};

type Props = {
  items: Array<FarcasterMention | null>;
  command: any;
};

export const MentionList = forwardRef<MentionListRef, Props>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const isMounted = useIsMounted();

  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      props.command({ id: item.username });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: Event }) => {
      if (!(event instanceof KeyboardEvent)) {
        return false;
      }

      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (!isMounted()) return null;
  const noResults = props.items && props.items?.length === 1 && props.items[0] === null;

  return (
    <div className="overflow-y-auto z-50 min-w-[20rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
      {props.items?.length && !noResults ? (
        props.items.map((item, index) =>
          !item ? null : (
            <div
              className={cn(
                'z-50 flex flex-row p-2 px-3 cursor-pointer gap-2 items-center hover:bg-accent hover:text-accent-foreground',
                index === selectedIndex && 'bg-accent text-accent-foreground'
              )}
              key={item.username}
              onClick={() => selectItem(index)}
            >
              <div
                style={{
                  borderRadius: '100%',
                  width: '48px',
                  height: '48px',
                  // image may not be a square
                  backgroundImage: `url(${item.avatar_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div>
                <div className="font-bold text-sm">{item.display_name}</div>
                <div className="font-bold text-muted-foreground text-sm">@{item.username}</div>
              </div>
            </div>
          )
        )
      ) : noResults ? (
        <div className="flex flex-row p-2 px-3">Not found</div>
      ) : (
        <div className="flex items-center space-x-2 p-2 px-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[50px]" />
          </div>
        </div>
      )}
    </div>
  );
});

MentionList.displayName = 'MentionList';
