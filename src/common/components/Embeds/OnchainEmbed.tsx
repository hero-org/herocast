import React from "react";

const OnchainEmbed = ({ url }: { url: string }) => {
  return <div key={`onchain-embed-${url}`}>{url}</div>;
}

export default OnchainEmbed;
