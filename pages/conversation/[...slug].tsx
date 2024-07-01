import React, { useEffect, useState } from "react";
import { NeynarAPIClient, isApiErrorResponse } from "@neynar/nodejs-sdk";
import { CastRow } from "@/common/components/CastRow";
import {
  CastParamType,
  CastWithInteractions,
} from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { useRouter } from "next/router";
import { CastThreadView } from "@/common/components/CastThreadView";
import SkeletonCastRow from "@/common/components/SkeletonCastRow";

export default function ConversationPage() {
  const router = useRouter();
  const { slug } = router.query as { slug?: string };

  // const [hash, setHash] = useState<string | null>(null);
  const [cast, setCast] = useState<CastWithInteractions | null>(null);
  console.log("Cast slug", slug, cast);
  useEffect(() => {
    // todo: parse slug to either hash, or profile/hash or warpcast url
    const getData = async () => {
      if (!slug || slug.length === 0) return;
      if (slug.length === 1 && !slug[0].startsWith("0x")) return;
      if (slug.length === 2 && !slug[1].startsWith("0x")) return;
      console.log("getData slug", slug);
      try {
        const neynarClient = new NeynarAPIClient(
          process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
        );
        const payload =
          slug.length === 2
            ? {
                value: `https://warpcast.com/${slug[0]}/${slug[1]}`,
                type: CastParamType.Url,
              }
            : {
                value: slug[0],
                type: CastParamType.Hash,
              };
        const res = await neynarClient.lookUpCastByHashOrWarpcastUrl(
          payload.value,
          payload.type
        );
        if (res && res.cast) {
          setCast(res.cast);
        }
      } catch (err) {
        console.error(`Error in conversation page: ${err} ${slug}`);
      }
    };

    getData();
  }, [slug]);

  return cast ? (
    <CastThreadView cast={cast} key={cast.hash} />
  ) : (
    <SkeletonCastRow />
  );
}
