import React, { useState } from "react";
import { useAccountStore } from "../../src/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { ChevronRightIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { classNames } from "../../src/common/helpers/css";
import { ChannelType } from "../../src/common/constants/channels";
import Toggle from "../../src/common/components/Toggle";
import findIndex from "lodash.findindex";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import includes from "lodash.includes";
import SortableList, { SortableItem } from "react-easy-sort";
import { useRouter } from "next/router";
import { take } from "lodash";

export default function Channels() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const {
    addPinnedChannel,
    removePinnedChannel,
    accounts,
    hydratedAt,
    allChannels,
    updatedPinnedChannelIndices,
  } = useAccountStore();

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
            "flex flex-1 items-center justify-between truncate border-foreground/60 bg-muted-background p-2 pr-4"
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
          </div>
          <Toggle
            enabled={enabled}
            setEnabled={() =>
              enabled ? removePinnedChannel(channel) : addPinnedChannel(channel)
            }
          />
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="p-12">
      <span className="text-muted-foreground">Empty, no channels found</span>
    </div>
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
                includes(channel.name.toLowerCase(), searchTerm)
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

  if (!hydratedAt) {
    return null;
  }

  return isEmpty(accounts) ? (
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
