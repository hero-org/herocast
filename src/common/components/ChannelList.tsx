import React from "react";
import { Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import clsx from "clsx";

type ChannelListRef = {
  onKeyDown: (props: { event: Event }) => boolean;
};

type Props = {
  items: Array<Channel | null>;
  command: any;
  query?: string;
};

export const ChannelList = forwardRef<ChannelListRef, Props>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  console.log('props', props);
  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      props.command({ id: item.id });
    }
  };

  const upHandler = () => {
    setSelectedIndex(
      (selectedIndex + props.items.length - 1) % props.items.length
    );
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

      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  const noResults = props.items.length === 1 && props.items[0] === null;

  return (
    // Menu messes with focus which we don't want here
    <div
      className="overflow-y-auto z-50 min-w-[20rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
      style={{ maxHeight: "300px" }}
    >
      {props.items.length && !noResults ? (
        props.items.map((item, index) =>
          !item ? null : (
            <div
              className={clsx(
                "flex flex-row p-2 px-3 cursor-pointer gap-2 items-center hover:bg-accent hover:text-accent-foreground",
                index === selectedIndex && "bg-accent text-accent-foreground"
              )}
              key={item.id}
              onClick={() => selectItem(index)}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  // image may not be a square
                  backgroundImage: `url(${item.image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div>
                <div className="font-bold text-sm">{item.name}</div>
                <div className="font-bold text-muted-foreground text-sm">
                  /{item.id}
                </div>
              </div>
            </div>
          )
        )
      ) : (noResults && props?.query)? (
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

ChannelList.displayName = "ChannelList";