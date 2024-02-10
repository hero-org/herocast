import React, { useState } from 'react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { Combobox } from '@headlessui/react';
import { useAccountStore } from '@/stores/useAccountStore';
import { ChannelType } from '../constants/channels';
import { classNames } from '../helpers/css';

type ChannelsComboboxProps = {
  selectedChannel?: ChannelType;
  onChange: (channel: ChannelType) => void;
}

const ChannelsDropdown = ({ selectedChannel, onChange }: ChannelsComboboxProps) => {
  const [query, setQuery] = useState('')

  const {
    allChannels: channels
  } = useAccountStore();

  const filteredChannels =
    query === ''
      ? channels
      : channels.filter((channel) => {
        return channel.name.toLowerCase().includes(query.toLowerCase())
      })

  return (
    <Combobox as="div" value={selectedChannel} onChange={onChange}>
      <Combobox.Label className="sr-only">Select channel</Combobox.Label>
      <div className="relative">
        <Combobox.Input
          className="w-full max-w-fit rounded-sm border-0 bg-radix-slate10 py-1.5 pl-3 pr-12 text-radix-slate4 placeholder:text-radix-slate6 shadow-sm ring-1 ring-inset ring-gray-500 focus:ring-1 focus:ring-inset focus:ring-gray-400 sm:text-sm sm:leading-6"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search channels"
          value={selectedChannel?.name}
        />
        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center justify-between rounded-r-md px-2 focus:outline-none">
          <ChevronUpDownIcon className="h-5 w-5 text-foreground/70" aria-hidden="true" />
        </Combobox.Button>

        {filteredChannels.length > 0 && (
          <Combobox.Options className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-radix-slate10 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {filteredChannels.map((channel) => (
              <Combobox.Option
                key={channel.id}
                value={channel}
                className={({ active }) =>
                  classNames(
                    'relative cursor-default select-none py-2 pl-3 pr-9',
                    active ? 'bg-radix-slate9 text-radix-slate4' : 'text-radix-slate2'
                  )
                }
              >
                {({ active, selected }) => (
                  <>
                    <div className="flex items-center">
                      {channel.icon_url ?
                        <img
                          src={channel.icon_url}
                          alt=""
                          className="h-6 w-6 flex-shrink-0 rounded-lg"
                        />
                        : <div className="h-6 w-6 flex-shrink-0 rounded-full bg-radix-slate8"></div>}
                      <span className={classNames('ml-3 truncate', selected ? 'font-semibold' : '')}>{channel.name}</span>
                    </div>

                    {selected && (
                      <span
                        className={classNames(
                          'absolute inset-y-0 right-0 flex items-center pr-4',
                          active ? 'text-radix-slate4' : 'text-radix-slate2'
                        )}
                      >
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </Combobox.Option>
            ))}
          </Combobox.Options>
        )}
      </div>
    </Combobox>
  )
}

export default ChannelsDropdown;
