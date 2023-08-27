import { InformationCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import React from "react";

export default function Search() {
  return (
    <div className="min-w-0 flex-1 px-12 mt-12">
      <div className="w-full max-w-lg rounded-sm bg-blue-800 p-3">
        <div className="flex">
          <div className="flex-shrink-0">
            <InformationCircleIcon className="h-5 w-5 text-blue-300" aria-hidden="true" />
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm text-blue-300">Search is coming soon<br />Use Cmd + Shift + F to share feedback</p>
          </div>
        </div>
      </div>
      <div className="w-full max-w-lg">
        <label htmlFor="desktop-search" className="sr-only">
          Search
        </label>
        <div className="relative text-gray-300 focus-within:text-gray-100">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <input
            id="desktop-search"
            className="block w-full rounded-sm border-0 bg-white/20 py-2.5 pl-10 pr-3 text-gray-300 placeholder:text-white focus:bg-white/30 focus:text-white focus:ring-0 focus:placeholder:text-gray-200 sm:text-sm sm:leading-6"
            placeholder="Search"
            type="search"
            name="search"
          />
        </div>
      </div>

    </div>
  )
}
