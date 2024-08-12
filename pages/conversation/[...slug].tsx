import React, { useEffect, useState } from "react";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { CastParamType, CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { useRouter } from "next/router";
import { CastThreadView } from "@/common/components/CastThreadView";
import { useDataStore } from "@/stores/useDataStore";

export default function ConversationPage() {
    const router = useRouter();
    const { slug } = router.query as { slug?: string };
    const [cast, setCast] = useState<CastWithInteractions | null>(null);
    const { updateSelectedCast } = useDataStore();

    useEffect(() => {
        // if navigating away, reset the selected cast
        return () => {
            updateSelectedCast();
        };
    }, []);

    function getPayloadFromSlug() {
        return slug && slug?.length === 2
            ? {
                  value: `https://warpcast.com/${slug[0]}/${slug[1]}`,
                  type: CastParamType.Url,
              }
            : {
                  value: slug[0],
                  type: CastParamType.Hash,
              };
    }

    useEffect(() => {
        const getData = async () => {
            if (!slug || slug.length === 0) return;
            if (slug.length === 1 && !slug[0].startsWith("0x")) return;
            if (slug.length === 2 && !slug[1].startsWith("0x")) return;

            try {
                const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
                const payload = getPayloadFromSlug();
                const res = await neynarClient.lookUpCastByHashOrWarpcastUrl(payload.value, payload.type);
                if (res && res.cast) {
                    setCast(res.cast);
                }
            } catch (err) {
                console.error(`Error in conversation page: ${err} ${slug}`);
            }
        };

        getData();
    }, [slug]);

    return (
        <div className="w-full">
            <CastThreadView cast={cast} />
        </div>
    );
}
