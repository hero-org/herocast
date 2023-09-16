import React from "react";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { ChevronRightIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { classNames } from "@/common/helpers/css";

export default function Channels() {
  const navigate = useNavigate();

  const {
    accounts,
    selectedAccountIdx,
    hydrated
  } = useAccountStore();

  // const isHydrated = useAccountStore(state => state._hydrated);

  const account: AccountObjectType = accounts[selectedAccountIdx];
  const channels = account.channels;

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
  const projects = [
    { name: 'Graph API', initials: 'GA', href: '#', members: 16, bgColor: 'bg-pink-600' },
    { name: 'Component Design', initials: 'CD', href: '#', members: 12, bgColor: 'bg-purple-600' },
    { name: 'Templates', initials: 'T', href: '#', members: 16, bgColor: 'bg-yellow-500' },
    { name: 'React Components', initials: 'RC', href: '#', members: 8, bgColor: 'bg-green-500' },
  ]
  const renderChannels = () => {
    return (
      <div>
        <h2 className="text-sm font-medium text-gray-500">Pinned channels</h2>
        <ul role="list" className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {channels.map((channel) => (
            <li key={`channel-pinned-${channel.name}`} className="col-span-1 flex rounded-md shadow-sm">
              <div
                className={classNames(
                  'flex w-16 flex-shrink-0 items-center justify-center rounded-l-md text-sm font-medium text-white'
                )}
              >
                {channel.name}
              </div>
              <div className="flex flex-1 items-center justify-between truncate rounded-r-md border-b border-r border-t border-gray-200 bg-white">
                <div className="flex-1 truncate px-4 py-2 text-sm">
                  <a href={channel.url} className="font-medium text-gray-900 hover:text-gray-600">
                    {channel.name}
                  </a>
                  <p className="text-gray-500">{channel.url} url</p>
                </div>
                <div className="flex-shrink-0 pr-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <span className="sr-only">Open options</span>
                    <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return hydrated && isEmpty(accounts) ? renderEmptyState() : (
    <div className="min-w-full mr-4">
      {renderChannels()}
    </div >
  )
}
