import React, { useEffect, useState } from "react";
import { NeynarAPIClient, isApiErrorResponse } from "@neynar/nodejs-sdk";
import { CastRow } from "@/common/components/CastRow";
import {
  CastParamType,
  CastResponse,
  CastWithInteractions,
} from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { useRouter } from "next/router";
import SkeletonCastRow from "@/common/components/SkeletonCastRow";
import { isEmpty } from "lodash";
import { CastThreadView } from "@/common/components/CastThreadView";

export default function Cast() {
  const router = useRouter();
  const { hash } = router.query as { hash?: string };
  const [cast, setCast] = useState<CastWithInteractions | null>(null);

  useEffect(() => {
    const getData = async () => {
      try {
        const neynarClient = new NeynarAPIClient(
          process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
        );
        const res = await neynarClient.lookUpCastByHashOrWarpcastUrl(
          hash,
          CastParamType.Hash
        );
        if (res && res.cast) {
          setCast(res.cast);
        }
      } catch (err) {
        console.log(`Error in conversation apge: ${err} ${hash}`);
      }
    };
    // if (hash) {
    //   getData();
    // }
  }, [hash]);

  return <CastThreadView hash={hash} key={hash} />;
}
