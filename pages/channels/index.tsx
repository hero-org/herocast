import React, { useState } from "react";
import {
  AccountObjectType,
  hydrate,
  useAccountStore,
} from "../../src/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { ChevronRightIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { classNames } from "../../src/common/helpers/css";
import { ChannelType } from "../../src/common/constants/channels";
import Toggle from "../../src/common/components/Toggle";
import findIndex from "lodash.findindex";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import includes from "lodash.includes";
import Modal from "../../src/common/components/Modal";
import { useForm, SubmitHandler } from "react-hook-form";
import get from "lodash.get";
import SortableList, { SortableItem } from "react-easy-sort";
import { useRouter } from "next/router";
import { Input } from "../../src/components/ui/input";
import { Button } from "../../src/components/ui/button";
import { take } from "lodash";

type Inputs = {
  name: string;
  url: string;
  iconUrl: string;
  account: string;
};

export default function Channels() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const {
    addPinnedChannel,
    removePinnedChannel,
    accounts,
    selectedAccountIdx,
    hydrated,
    allChannels,
    addChannel,
    updatedPinnedChannelIndices,
  } = useAccountStore();

  const account: AccountObjectType = accounts[selectedAccountIdx];
  // const channels = account?.channels || [];
  const channels = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]?.channels || []
  );

  const onSortEnd = (oldIndex: number, newIndex: number) => {
    updatedPinnedChannelIndices({ oldIndex, newIndex });
  };

  const handleSearchChange = (e: event) => {
    setSearchTerm(e.target.value.toLowerCase());
  };

  const renderChannelCard = (channel: ChannelType, idx?: number) => {
    const index = findIndex(channels, ["url", channel.url]);
    const enabled = index !== -1;

    return (
      <div
        className={classNames(
          enabled ? "cursor-move" : "",
          "flex flex-row w-full max-w-lg"
        )}
      >
        {enabled && idx !== undefined && (
          <div
            className={classNames(
              "text-background bg-green-600/80 border-foreground/60 border flex w-10 flex-shrink-0 items-center justify-center rounded-l-lg text-lg font-medium"
            )}
          >
            {idx + 1}
          </div>
        )}
        <div
          className={classNames(
            enabled && idx !== undefined
              ? "rounded-r-lg border-b border-r border-t"
              : "rounded-lg border",
            "flex flex-1 items-center justify-between truncate border-foreground/60 bg-muted-background pr-4"
          )}
        >
          {channel.icon_url ? (
            <img
              src={channel.icon_url}
              alt=""
              className="ml-2 mt-0.5 rounded-lg border border-gray-600 h-8 w-8 flex-none bg-background"
            />
          ) : (
            <div className="ml-2" />
          )}
          <div className="flex-1 truncate pl-2 pr-4 py-2 text-sm">
            <p className="truncate font-medium text-foreground/80">
              {channel.name}
            </p>
            {channel.source && (
              <p className="text-foreground/70 truncate">
                Added by {channel.source}
              </p>
            )}
          </div>
          <Toggle
            enabled={enabled}
            setEnabled={() =>
              enabled ? removePinnedChannel(channel) : addPinnedChannel(channel)
            }
          />
          {/* <div className="flex-shrink-0 pr-2">
            <button
              type="button"
              className="ml-2 inline-flex h-8 w-4 items-center justify-center rounded-sm bg-transparent text-foreground/70 hover:text-foreground/80 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              <span className="sr-only">Open options</span>
              <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div> */}
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <>
      <div className="max-w-7xl px-6 pb-24 sm:pb-32 lg:flex lg:px-8">
        <div className="mx-auto max-w-2xl flex-shrink-0 lg:mx-0 lg:max-w-xl">
          <div className="mt-12">
            <a
              href="https://paragraph.xyz/@hellno/herocast-log-nr2"
              target="_blank"
              rel="noreferrer"
              className="inline-flex space-x-6"
            >
              <span className="rounded-full bg-green-700/10 px-3 py-1 text-sm font-semibold leading-6 text-green-400 ring-1 ring-inset ring-green-700/20">
                What&apos;s new
              </span>
              <span className="inline-flex items-center space-x-2 text-sm font-medium leading-6 text-foreground/80">
                <span>Just shipped an update for you</span>
                <ChevronRightIcon
                  className="h-5 w-5 text-foreground/80"
                  aria-hidden="true"
                />
              </span>
            </a>
          </div>
          <h1 className="mt-10 text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Welcome to herocast
          </h1>
          <p className="mt-6 text-lg leading-8 text-foreground/80">
            herocast is a desktop Farcaster client for power users aka
            superhuman for Farcaster. <br />
            <br />
            It has support for multiple accounts and can switch channels faster
            than you can say &apos;Memes&apos;. It supports{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              Cmd + K
            </kbd>{" "}
            (command palette) to control everything. You can navigate with{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              j
            </kbd>{" "}
            and{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              k
            </kbd>
            through all lists,{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              l
            </kbd>{" "}
            to like (lowercase L) and{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              r
            </kbd>{" "}
            to recast. Switch channels on Feed page with{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              Shift + 1 to 9
            </kbd>
            . Open external links in a cast with{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-foreground/80 border-gray-600">
              Shift + o
            </kbd>
            .
          </p>
          <div className="mt-10 flex items-center gap-x-6">
            <button
              onClick={() => router.push("/accounts")}
              className="flex rounded-sm bg-green-700 px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
            >
              Get started{" "}
              <UserPlusIcon
                className="ml-2 h-5 w-5 text-foreground/80"
                aria-hidden="true"
              />
            </button>
            <a
              href="https://paragraph.xyz/@hellno/herocast-log-nr2"
              target="_blank"
              rel="noreferrer"
              className="rounded-sm px-3.5 py-2 text-sm font-semibold leading-6 text-foreground outline outline-gray-500"
            >
              Learn more <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );

  const renderPinnedChannels = () => {
    return (
      <div>
        <div className="border-b border-gray-500 sm:flex sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <h2 className="text-lg font-medium text-foreground/80 leading-6">
              Pinned channels
            </h2>
          </div>
        </div>
        <ul role="list" className="mt-3 ">
          {isEmpty(channels) ? (
            <div className="mt-0.5 h-14 col-span-2 flex rounded-sm">
              <p className="text-muted-foreground">
                Start pinning channels and they will appear up here
              </p>
            </div>
          ) : (
            <SortableList
              onSortEnd={onSortEnd}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
            >
              {channels.map((channel, idx) => (
                <SortableItem key={`channel-pinned-${channel.id}`}>
                  <div className="col-span-1 flex rounded-md shadow-sm">
                    {renderChannelCard(channel, idx)}
                  </div>
                </SortableItem>
              ))}
            </SortableList>
          )}
        </ul>
      </div>
    );
  };

  const renderAllChannels = () => {
    return (
      <div className="mt-8 min-h-full">
        <div className="border-b border-gray-500 sm:flex sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <h2 className="text-lg font-medium text-foreground/80 leading-6">
              All channels
            </h2>
            <h3 className="text-sm font-medium text-foreground/80">
              Search and pin new channels
            </h3>
          </div>
          <div className="pb-3 mt-3 sm:ml-4 sm:mt-0">
            <label htmlFor="mobile-search-channel" className="sr-only">
              Search
            </label>
            <label htmlFor="desktop-search-channel" className="sr-only">
              Search
            </label>
            <div className="flex rounded-md shadow-sm max-w-md">
              <div className="relative flex-grow focus-within:z-10">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MagnifyingGlassIcon
                    className="h-5 w-5 text-foreground/70"
                    aria-hidden="true"
                  />
                </div>
                <input
                  onChange={handleSearchChange}
                  value={searchTerm}
                  type="text"
                  name="mobile-search-channel"
                  id="mobile-search-channel"
                  className="block w-full rounded-md border-0 py-2.5 pl-10 bg-white/20 pr-3 text-foreground/80 placeholder:text-foreground focus:bg-white/10 focus:text-foreground ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-200 sm:hidden"
                  placeholder="Search"
                />
                <input
                  onChange={handleSearchChange}
                  value={searchTerm}
                  type="text"
                  name="desktop-search-channel"
                  id="desktop-search-channel"
                  className="hidden w-full rounded-md border-0 py-2 pl-10 bg-white/20 pr-3 text-foreground/80 placeholder:text-foreground focus:bg-white/10 focus:text-foreground ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-200 sm:block"
                  placeholder="Search channels"
                />
              </div>
            </div>
          </div>
        </div>
        <ul
          role="list"
          className="mt-3 mb-48 grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6"
        >
          {(searchTerm
            ? allChannels.filter((channel) =>
                includes(
                  (channel.name).toLowerCase(),
                  searchTerm
                )
              )
            : take(allChannels, 50)
          ).map((channel) => (
            <li
              key={`all-channels-${channel.id}`}
              className="col-span-1 flex rounded-md shadow-sm"
            >
              {renderChannelCard(channel)}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return hydrated && isEmpty(accounts) ? (
    renderEmptyState()
  ) : (
    <>
      <div className="w-full md:max-w-screen-sm xl:max-w-screen-lg m-4">
        {renderPinnedChannels()}
        {renderAllChannels()}
      </div>
    </>
  );
}
