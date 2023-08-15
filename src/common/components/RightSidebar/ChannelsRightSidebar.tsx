import ChannelsOverview from "./ChannelsOverview";

const ChannelsRightSidebar = () => {
  return <aside className="bg-gray-800 lg:fixed lg:bottom-0 lg:right-0 lg:top-20 lg:w-80 lg:overflow-y-auto lg:border-l lg:border-white/5">
    <ChannelsOverview />
  </aside>
}

export default ChannelsRightSidebar;
