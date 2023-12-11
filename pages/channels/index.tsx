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
import { Input } from "../../src/components/ui/Input";

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

  console.log('channels', allChannels);

  const account: AccountObjectType = accounts[selectedAccountIdx];
  // const channels = account?.channels || [];
  const channels = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]?.channels || []
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({
    values: { account: account?.name || "" },
  });

  const onSortEnd = (oldIndex: number, newIndex: number) => {
    updatedPinnedChannelIndices({ oldIndex, newIndex });
  };

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setIsPending(true);
    await Promise.resolve(addChannel(data));
    setShowNewChannelModal(false);
    setIsPending(false);
    hydrate();
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
              "bg-green-600/80 border-gray-200 border flex w-10 flex-shrink-0 items-center justify-center rounded-l-md text-lg font-medium text-white"
            )}
          >
            {idx + 1}
          </div>
        )}
        <div
          className={classNames(
            enabled && idx !== undefined
              ? "rounded-r-md border-b border-r border-t"
              : "rounded-md border",
            "flex flex-1 items-center justify-between truncate border-gray-200 bg-gray-600 pr-4"
          )}
        >
          {channel.icon_url ? (
            <img
              src={channel.icon_url}
              alt=""
              className="ml-2 mt-0.5 rounded-lg border border-gray-600 h-8 w-8 flex-none bg-gray-800"
            />
          ) : (
            <div className="ml-2" />
          )}
          <div className="flex-1 truncate pl-2 pr-4 py-2 text-sm">
            <p className="truncate font-medium text-gray-100 hover:text-gray-200">
              {channel.name}
            </p>
            {channel.source && (
              <p className="text-gray-300 truncate">
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
              className="ml-2 inline-flex h-8 w-4 items-center justify-center rounded-sm bg-transparent text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
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
              <span className="inline-flex items-center space-x-2 text-sm font-medium leading-6 text-gray-300">
                <span>Just shipped an update for you</span>
                <ChevronRightIcon
                  className="h-5 w-5 text-gray-500"
                  aria-hidden="true"
                />
              </span>
            </a>
          </div>
          <h1 className="mt-10 text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Welcome to herocast
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            herocast is a desktop Farcaster client for power users aka
            superhuman for Farcaster. <br />
            <br />
            It has support for multiple accounts and can switch channels faster
            than you can say &apos;Memes&apos;. It supports{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              Cmd + K
            </kbd>{" "}
            (command palette) to control everything. You can navigate with{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              j
            </kbd>{" "}
            and{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              k
            </kbd>
            through all lists,{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              l
            </kbd>{" "}
            to like (lowercase L) and{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              r
            </kbd>{" "}
            to recast. Switch channels on Feed page with{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              Shift + 1 to 9
            </kbd>
            . Open external links in a cast with{" "}
            <kbd className="px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
              Shift + o
            </kbd>
            .
          </p>
          <div className="mt-10 flex items-center gap-x-6">
            <button
              onClick={() => router.push("/accounts")}
              className="flex rounded-sm bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
            >
              Get started{" "}
              <UserPlusIcon
                className="ml-2 h-5 w-5 text-gray-100"
                aria-hidden="true"
              />
            </button>
            <a
              href="https://paragraph.xyz/@hellno/herocast-log-nr2"
              target="_blank"
              rel="noreferrer"
              className="rounded-sm px-3.5 py-2 text-sm font-semibold leading-6 text-white outline outline-gray-500"
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
            <h2 className="text-lg font-medium text-gray-100 leading-6">
              Pinned channels
            </h2>
          </div>
          <div className="pb-3 mt-3 sm:ml-4 sm:mt-2">
            <button
              onClick={() => setShowNewChannelModal(true)}
              className="text-gray-100 bg-gray-600 hover:bg-gray-500 inline-flex h-[35px] items-center justify-center rounded-sm px-[15px] font-medium leading-none outline-none focus:bg-gray-500"
            >
              Add channel
            </button>
          </div>
        </div>
        <ul role="list" className="mt-3 ">
          {isEmpty(channels) ? (
            <div className="mt-0.5 h-14 col-span-2 flex rounded-sm">
              <p className="text-gray-200 ">
                Start pinning channels and they will appear up here
              </p>
            </div>
          ) : (
            <SortableList
              onSortEnd={onSortEnd}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
            >
              {channels.map((channel, idx) => (
                <SortableItem key={`channel-pinned-${channel.name}`}>
                  <li className="col-span-1 flex rounded-md shadow-sm">
                    {renderChannelCard(channel, idx)}
                  </li>
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
      <div className="mt-8">
        <div className="border-b border-gray-500 sm:flex sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <h2 className="text-lg font-medium text-gray-100 leading-6">
              All channels
            </h2>
            <h3 className="text-sm font-medium text-gray-300">
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
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </div>
                <input
                  onChange={handleSearchChange}
                  value={searchTerm}
                  type="text"
                  name="mobile-search-channel"
                  id="mobile-search-channel"
                  className="block w-full rounded-md border-0 py-2.5 pl-10 bg-white/20 pr-3 text-gray-300 placeholder:text-white focus:bg-white/10 focus:text-white ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-200 sm:hidden"
                  placeholder="Search"
                />
                <input
                  onChange={handleSearchChange}
                  value={searchTerm}
                  type="text"
                  name="desktop-search-channel"
                  id="desktop-search-channel"
                  className="hidden w-full rounded-md border-0 py-2 pl-10 bg-white/20 pr-3 text-gray-300 placeholder:text-white focus:bg-white/10 focus:text-white ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-200 sm:block"
                  placeholder="Search channels"
                />
              </div>
            </div>
          </div>
        </div>
        <ul
          role="list"
          className="mt-3 mb-48 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6"
        >
          {(searchTerm
            ? allChannels.filter((channel) =>
                includes(
                  (channel.name + channel.source + channel.url).toLowerCase(),
                  searchTerm
                )
              )
            : allChannels
          ).map((channel) => (
            <li
              key={`channel-${channel.name}`}
              className="col-span-1 flex rounded-md shadow-sm"
            >
              {renderChannelCard(channel)}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderTextField = (
    displayName: string,
    name: keyof Inputs,
    placeholder?: string,
    description?: JSX.Element | string,
    registerArgs?: any
  ) => (
    <fieldset className="mb-[10px] flex items-start gap-5">
      <label
        className="text-gray-100 w-[90px] text-left text-[15px]"
        htmlFor={name}
      >
        {displayName}
      </label>
      <div className="flex flex-col w-full">
        <Input
          {...register(name, registerArgs)}
          className="bg-gray-600 text-gray-100 shadow-gray-600 placeholder-gray-500 focus:shadow-gray-800"
          id={name}
          placeholder={placeholder}
        />
        {get(errors, name) && (
          <p className="mt-2 h-8 text-sm text-red-600" id={`${name}-error`}>
            {get(errors, name)?.message} {get(errors, name)?.type}
          </p>
        )}
        <div className="my-2 text-sm text-gray-400">{description}</div>
      </div>
    </fieldset>
  );

  const getUrlExplainer = () => (
    <div className="flex flex-col">
      <p>
        fill with any URL or{" "}
        <a
          className="underline font-semibold"
          href="https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-19.md"
        >
          {" "}
          onchain format CAIP-19
        </a>
      </p>
      <p className="mt-2 text-gray-400 break-words">
        Music channel has URL:{" "}
        <span className="font-mono tracking-tighter">
          chain://eip155:7777777/erc721:0xe96c...634
        </span>
        <br />
        Bitcoin channel has URL:{" "}
        <span className="font-mono tracking-tighter">https://bitcoin.org</span>
      </p>
    </div>
  );

  return hydrated && isEmpty(accounts) ? (
    renderEmptyState()
  ) : (
    <>
      <div className="w-full md:max-w-screen-sm xl:max-w-screen-lg mr-4">
        {renderPinnedChannels()}
        {renderAllChannels()}
      </div>
      <Modal
        open={showNewChannelModal}
        setOpen={setShowNewChannelModal}
        title="Add channel to herocast"
        description="Custom channel for you and others to follow and pin in herocast. Casts are visible in Warpcast and other clients. Herocast channels are not visible in Warpcast, but casts appear in all clients."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="mt-12">
          {renderTextField("Channel Name", "name", "Vitalik Test Channel", "", {
            required: true,
            maxLength: 80,
          })}
          {renderTextField(
            "URL",
            "url",
            "vitalik.eth",
            getUrlExplainer(),
            { required: true, minLength: 5 }
          )}
          {/* {renderTextField("Icon Url", "iconUrl", "xyz/test.png")} */}
          <div className="mt-[25px] flex justify-end">
            <input
              type="submit"
              value={isPending ? "..." : "Add Channel"}
              className="cursor-pointer bg-green-200 text-green-800 hover:bg-green-300 focus:shadow-green-700 inline-flex h-[35px] items-center justify-center rounded-[4px] px-[15px] font-medium leading-none focus:shadow-[0_0_0_2px] focus:outline-none"
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
