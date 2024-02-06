import React, { useEffect, useState } from "react";
import { CastRow } from "../CastRow";
import isEmpty from "lodash.isempty";
import { CastParamType, NeynarAPIClient } from "@neynar/nodejs-sdk";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { CastResponse } from "@neynar/nodejs-sdk/build/neynar-api/v2";

const CastEmbed = ({ url, castId }: { url?: string, castId?: { hash: string, fid: number }}) => {
  const [cast, setCast] = useState<CastWithInteractions | null>(null);

  useEffect(() => {
    const getData = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      
      let res: CastResponse | null;
      if (url) {
        res = await neynarClient.lookUpCastByHashOrWarpcastUrl(url, CastParamType.Url);
      } else if (castId) {
        res = await neynarClient.lookUpCastByHashOrWarpcastUrl(castId.hash, CastParamType.Hash);
      } else {
        return;
      }
      
      if (res && res.cast) {
        setCast(res.cast);
      }
    };

    getData();
  }, []);

  if ((!url && !castId) || isEmpty(cast)) return null;

  return (
    <div
      key={`onchain-embed-${url}`}
      className="border border-gray-600 rounded-sm"
    >
      <CastRow cast={cast} showChannel />
    </div>
  );
}

export default CastEmbed;
