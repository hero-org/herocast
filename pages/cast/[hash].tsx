import React from "react";
import { NeynarAPIClient, isApiErrorResponse, FilterType } from "@neynar/nodejs-sdk";
import { CastRow } from "@/common/components/CastRow";
import { CastResponse } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { GetStaticPaths, GetStaticProps } from "next";
import { isUndefined, uniqBy } from "lodash";

export const getStaticProps = (async function (context) {
  const hash = context.params?.hash;
  if (isUndefined(hash) || Array.isArray(hash)) {
    return {
      notFound: true,
    }
  }
  const client = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
  let cast: CastResponse | undefined;
  try {
    cast = await client.lookUpCastByHashOrWarpcastUrl(hash, "hash");
  } catch (error) {
    // isApiErrorResponse can be used to check for Neynar API errors
    if (isApiErrorResponse(error)) {
      console.log("API Error", error, error.response.data);
    } else {
      console.log("Generic Error", error);
    }

    return {
      notFound: true,
    }
  }

  return {
    props: {
      cast
    },

    // Next.js will attempt to re-generate the page:
    // - When a request comes in
    // - At most once every 60 seconds
    revalidate: 60,
  };
}) satisfies GetStaticProps<{
  cast: CastResponse | undefined
}>

export const getStaticPaths = (async () => {
  const client = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

  const globalFeed = await client.fetchFeed("filter", {
    filterType: FilterType.GlobalTrending,
    limit: 100,
  });

  const paths = uniqBy(
    globalFeed.casts.map(({ hash }) => ({
      params: {
        hash
      },
    })),
    "params.hash"
  );

  console.log(`preparing static casts: ${paths.length}`);
  return {
    paths,
    fallback: 'blocking',
  };
}) satisfies GetStaticPaths;

export default function Cast({ cast }) {
  return (
    <CastRow 
      cast={cast.cast}
    />
  )
}
