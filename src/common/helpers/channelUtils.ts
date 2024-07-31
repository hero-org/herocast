import get from "lodash.get";
import { DataStore, useDataStore } from "@/stores/useDataStore";

export const getChannelFetchIfNeeded = async (channelUrl: string) => {
  let channel = getChannel(useDataStore.getState(), channelUrl);
  if (!channel) {
    channel = await fetchAndAddChannel({
      channelUrl
    });
  }
  return channel;
};

export const fetchAndAddChannel = async ({
  channelUrl,
}: {
  channelUrl: string;
}) => {
  const response = await fetch(`/api/channel?channelUrl=${channelUrl}`);
  if (response.ok) {
    const channel = (await response.json())?.channel;
    const { addChannelData } = useDataStore.getState();
    addChannelData({ channel });
    return channel;
  }

};

export const getChannel = (dataStoreState: DataStore, channelUrl: string) => {
  return get(dataStoreState.channelUrlToData, channelUrl);
};
