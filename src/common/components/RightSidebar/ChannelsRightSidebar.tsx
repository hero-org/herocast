import React from 'react';
import ChannelsOverview from "./ChannelsOverview";

const ChannelsRightSidebar = () => {
  return <aside className="bg-background md:fixed md:bottom-0 md:right-0 md:top-16 md:w-48 lg:w-64 md:border-l md:border-white/5">
    <ChannelsOverview />
  </aside>
}

export default ChannelsRightSidebar;
