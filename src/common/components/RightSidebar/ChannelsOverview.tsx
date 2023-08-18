import { ChannelType } from "@/common/constants/channels";
import { classNames } from "@/common/helpers/css";
import { useAccountStore } from "@/stores/useAccountStore";
import { useState } from "react";
import { SidebarHeader } from "./SidebarHeader";

const ChannelsOverview = () => {
  const [showAll, setShowAll] = useState(false);
  const {
    channels,
    selectedChannelIdx
  } = useAccountStore();

  const onToggleShowAll = () => {
    setShowAll(!showAll);
  }

  return (<div>
    <SidebarHeader title="Channels" actionTitle={showAll ? 'Show less' : 'Show all'} onClick={onToggleShowAll} />
    <ul role="list" className="mt-2 space-y-1">
      <li key="follow-feed" className="px-4 sm:px-6 lg:px-8">
        <span
          onClick={() => {
            useAccountStore.getState().setCurrentChannelIdx(null);
          }}
          className={classNames(
            selectedChannelIdx == null
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800',
            'group align-center justify-between flex gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer'
          )}
        >
          <span className="font-normal truncate">Follow feed</span>
          <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
            Shift + 0
          </kbd>
        </span>
      </li>
      {(showAll ? channels : channels.slice(0, 9)).map((channel: ChannelType, idx: number) => (
        <li key={channel.name} className="px-4 sm:px-6 lg:px-8">
          <div
            onClick={() => {
              useAccountStore.getState().setCurrentChannelIdx(idx);
            }}
            className={classNames(
              selectedChannelIdx == idx
                ? 'text-white font-semibold'
                : 'text-gray-400 hover:text-white',
              'flex align-center justify-between flex gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer'
            )}
          >
            <span className="font-normal truncate">{channel.name}</span>
            {idx < 9 && (
              <kbd className="px-1.5 py-0.5 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
                Shift + {idx + 1}
              </kbd>
            )}
          </div>
        </li>
      ))}
    </ul>
  </div>)
}

export default ChannelsOverview;
