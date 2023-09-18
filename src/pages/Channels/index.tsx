import React, { Fragment } from "react";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { ChevronRightIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { classNames } from "@/common/helpers/css";
import { ChannelType } from "@/common/constants/channels";
import Toggle from "@/common/components/Toggle";
import findIndex from "lodash.findindex";

export default function Channels() {
  const navigate = useNavigate();

  const {
    addPinnedChannel,
    removePinnedChannel,
    accounts,
    selectedAccountIdx,
    hydrated,
    allChannels,
  } = useAccountStore();

  const account: AccountObjectType = accounts[selectedAccountIdx];
  const channels = account?.channels || [];

  const renderChannelCard = (channel: ChannelType, idx?: number) => {
    const index = findIndex(channels, ['url', channel.url]);
    const enabled = index !== -1;

    return (
      <div className="flex flex-row w-full max-w-xs">
        {enabled && idx !== undefined && (<div
          className={classNames(
            'bg-green-600/80 border-gray-200 border flex w-10 flex-shrink-0 items-center justify-center rounded-l-md text-lg font-medium text-white'
          )}
        >
          {idx + 1}
        </div>)}
        <div className={classNames(
          enabled && idx !== undefined ? 'rounded-r-md border-b border-r border-t' : 'rounded-md border',
          "flex flex-1 items-center justify-between truncate border-gray-200 bg-gray-600 pr-4"
        )}>
          <div className="flex-1 truncate px-4 py-2 text-sm">
            <p className="truncate font-medium text-gray-100 hover:text-gray-200">
              {channel.name}
            </p>
            {channel.source && (<p className="text-gray-300 truncate">Added by {channel.source}</p>)}
          </div>
          <Toggle
            enabled={enabled}
            setEnabled={() => enabled ? removePinnedChannel(channel) : addPinnedChannel(channel)}
          />
          {/* <div className="flex-shrink-0 pr-2">
            <button
              type="button"
              className="ml-2 inline-flex h-8 w-4 items-center justify-center rounded-sm bg-transparent bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <span className="sr-only">Open options</span>
              <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div> */}
        </div>
      </div>
    )
  };

  const renderEmptyState = () => (
    <>
      <div className="max-w-7xl px-6 pb-24 sm:pb-32 lg:flex lg:px-8">
        <div className="mx-auto max-w-2xl flex-shrink-0 lg:mx-0 lg:max-w-xl">
          <div className="mt-12">
            <a href="https://paragraph.xyz/@hellno/herocast-log-nr2" target="_blank" rel="noreferrer"
              className="inline-flex space-x-6">
              <span className="rounded-full bg-green-700/10 px-3 py-1 text-sm font-semibold leading-6 text-green-400 ring-1 ring-inset ring-green-700/20">
                What&apos;s new
              </span>
              <span className="inline-flex items-center space-x-2 text-sm font-medium leading-6 text-gray-300">
                <span>Just shipped an update for you</span>
                <ChevronRightIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
              </span>
            </a>
          </div>
          <h1 className="mt-10 text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Welcome to herocast
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            herocast is a desktop Farcaster client for power users aka superhuman for Farcaster. <br /><br />
            It has support for multiple accounts and can switch channels faster than you can say &apos;Memes&apos;. It supports{' '}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              Cmd + K
            </kbd> (command palette) to control everything.
            You can navigate with <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              j
            </kbd> and <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              k
            </kbd>through all lists, <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              l
            </kbd> to like (lowercase L) and <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              r
            </kbd> to recast. Switch channels on Feed page with <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              Shift + 1 to 9
            </kbd>. Open external links in a cast with <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              Shift + o
            </kbd>.
          </p>
          <div className="mt-10 flex items-center gap-x-6">
            <button
              onClick={() => navigate('/accounts')}
              className="flex rounded-sm bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
            >
              Get started <UserPlusIcon className="ml-2 h-5 w-5 text-gray-100" aria-hidden="true" />
            </button>
            <a href="https://paragraph.xyz/@hellno/herocast-log-nr2" target="_blank" rel="noreferrer"
              className="rounded-sm px-3.5 py-2 text-sm font-semibold leading-6 text-white outline outline-gray-500">
              Learn more <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </>
  )

  const renderPinnedChannels = () => {
    return (
      <div>
        <h2 className="text-lg font-medium text-gray-100">Pinned channels</h2>
        <ul role="list" className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {isEmpty(channels) ? <div className="mt-0.5 h-14 col-span-2 flex rounded-sm">
            <p className="text-gray-200 ">Start pinning channels and they will appear up here</p>
          </div> : channels.map((channel, idx) => (
            <li key={`channel-pinned-${channel.name}`} className="col-span-1 flex rounded-md shadow-sm">
              {renderChannelCard(channel, idx)}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const renderAllChannels = () => {
    return (
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-100">All channels</h2>
        <ul role="list" className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {allChannels.map((channel) => (
            <li key={`channel-${channel.name}`} className="col-span-1 flex rounded-md shadow-sm">
              {renderChannelCard(channel)}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return hydrated && isEmpty(accounts) ? renderEmptyState() : (
    <div className="w-full md:max-w-screen-sm xl:max-w-screen-lg mr-4">
      {renderPinnedChannels()}
      {renderAllChannels()}
    </div >
  )
}
