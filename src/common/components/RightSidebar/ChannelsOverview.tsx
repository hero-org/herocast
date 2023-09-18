import React from "react";
import { ChannelType } from "@/common/constants/channels";
import { classNames } from "@/common/helpers/css";
import { useAccountStore } from "@/stores/useAccountStore";
import { SidebarHeader } from "./SidebarHeader";
import { useNavigate } from "react-router-dom";

const ChannelsOverview = () => {
  const navigate = useNavigate();
  const {
    selectedChannelUrl,
    setSelectedChannelUrl,
    resetSelectedChannel
  } = useAccountStore();

  let channels: ChannelType[] = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.channels);
  if (!channels) channels = [];

  return (<>
    <SidebarHeader title="Channels" actionTitle={'Manage'} onClick={() => navigate('/channels')} />
    <ul role="list" className="mx-4 m-4">
      <li key="follow-feed" className="px-2 sm:px-3 lg:px-6">
        <span
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
        </span>
      </li>
      {channels.map((channel: ChannelType, idx: number) => (
        <li key={channel.name} className="px-2 sm:px-3 lg:px-6">
          <div
            onClick={() => setSelectedChannelUrl(channel.url)}
            className={classNames(
              selectedChannelUrl === channel.url
                ? 'text-white font-semibold'
                : 'text-gray-400 hover:text-white',
              'flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer'
            )}
          >
            <div className="flex">
              {channel.icon_url && (<img src={channel.icon_url} alt="" className="-ml-7 mr-2 mt-0.5 border border-gray-400 h-5 w-5 flex-none rounded-full bg-gray-800" />)}
              <span className="font-normal truncate">{channel.name}</span>
            </div>
            {idx < 9 && (
              <kbd className="px-1.5 py-0.5 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
                {idx + 1}
              </kbd>
            )}
          </div>
        </li>
      ))}
    </ul>
  </>)
}

export default ChannelsOverview;
