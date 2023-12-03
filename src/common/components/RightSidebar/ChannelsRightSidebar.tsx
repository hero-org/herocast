import React from 'react';
import ChannelsOverview from "./ChannelsOverview";

const ChannelsRightSidebar = () => {
  return <aside className="bg-gray-800 lg:fixed lg:bottom-0 lg:right-0 lg:top-16 lg:w-64 lg:overflow-y-auto lg:border-l lg:border-white/5">
    <ChannelsOverview />
  </aside>
}

export default ChannelsRightSidebar;
