import React from "react";
import { ChannelType } from "@/common/constants/channels";
import { classNames } from "@/common/helpers/css";
import { useAccountStore } from "@/stores/useAccountStore";
import { SidebarHeader } from "./SidebarHeader";
import * as Tooltip from '@radix-ui/react-tooltip';
import { useRouter } from "next/router";

const ChannelsOverview = () => {
    const router = useRouter()
  const {
    selectedChannelUrl,
    setSelectedChannelUrl,
    resetSelectedChannel
  } = useAccountStore();

  let channels: ChannelType[] = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.channels);
  if (!channels) channels = [];

  return (<div className="mt-4">
    <SidebarHeader title="Channels" actionTitle={'Manage'} onClick={() => router.push('/channels')} />
    <ul role="list" className="my-2 overflow-y-scroll">
      <li key="follow-feed" className="px-2 sm:px-3 lg:px-4">
        <div
          onClick={() => resetSelectedChannel()}
          className={classNames(
            selectedChannelUrl === ''
              ? 'bg-gray-800 text-gray-100'
              : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800',
            'group align-center justify-between flex gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer'
          )}
        >
          <span className="font-normal truncate">Feed</span>
          <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
            Shift + 0
          </kbd>
        </div>
      </li>
      {channels.map((channel: ChannelType, idx: number) => (
        <li key={channel.name} className="px-2 sm:px-3 lg:px-4">
          <div
            onClick={() => setSelectedChannelUrl(channel.url)}
            className={classNames(
              selectedChannelUrl === channel.url
                ? 'text-white font-semibold'
                : 'text-gray-400 hover:text-white',
              'flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer'
            )}
          >
            <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div className="flex max-w-sm">
                    {channel.icon_url && (
                      <img
                        src={channel.icon_url}
                        alt=""
                        className={classNames(
                          selectedChannelUrl === channel.url ? 'border-gray-100' : 'border-gray-400 hover:border-gray-300',
                          "mr-1 mt-0.5 bg-gray-100 border h-5 w-5 flex-none rounded-full")}
                      />
                    )}
                    <span className="flex-nowrap w-24 truncate">{channel.name}</span>
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    align={"center"}
                    className="flex text-white data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade text-violet11 select-none rounded-[4px] bg-gray-700 px-[15px] py-[10px] text-[15px] leading-none shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] will-change-[transform,opacity]"
                    side="left"
                    sideOffset={5}
                  >
                    <div className="flex align-center">
                    {channel.icon_url && (
                      <img
                        src={channel.icon_url}
                        alt=""
                        className={classNames(
                          selectedChannelUrl === channel.url ? 'border-gray-100' : 'border-gray-400 hover:border-gray-300',
                          "mr-2 -mt-0.5 bg-gray-100 border h-5 w-5 flex-none rounded-full")}
                      />
                    )}
                    <span className="flex-nowrap">
                      {channel.name}
                    </span>
                    </div>
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
            {idx < 9 && (
              <kbd className="flex flex-nowrap md:w-18 px-1.5 py-0.5 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
                Shift + {idx + 1}
              </kbd>
            )}
          </div>
        </li>
      ))}
    </ul>
  </div >)
}

export default ChannelsOverview;
