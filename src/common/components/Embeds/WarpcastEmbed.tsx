import { CastType } from "@/common/constants/farcaster";
import { resolveWarpcastUrl } from "@/common/helpers/neynar";
import React, { useEffect, useState } from "react";
import { CastRow } from "../CastRow";
import isEmpty from "lodash.isempty";

const WarpcastEmbed = ({ url }: { url: string }) => {
  const [cast, setCast] = useState<CastType | null>(null);

  useEffect(() => {
    const getData = async () => {
      setCast(await resolveWarpcastUrl(url));
    };

    getData();
  }, []);

  return (
    <div
      key={`onchain-embed-${url}`}
      className="border border-gray-600 rounded-sm"
    >
      {!isEmpty(cast) && <CastRow cast={cast} showChannel />}
    </div>
  );
}

export default WarpcastEmbed;
