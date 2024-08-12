import React from "react";
import OnchainEmbed from "./OnchainEmbed";
import CastEmbed from "./CastEmbed";
import TweetEmbed from "./TweetEmbed";
import NounsBuildEmbed from "./NounsBuildEmbed";
import ParagraphXyzEmbed from "./ParagraphXyzEmbed";
import VideoEmbed from "./VideoEmbed";
import { WarpcastImage } from "../PostEmbeddedContent";
import FrameEmbed from "./FrameEmbed";
import { isImageUrl } from "@/common/helpers/text";

type CastEmbed = {
    url?: string;
    cast_id?: {
        fid: number;
        hash: string;
    };
    castId?: {
        fid: number;
        hash: string;
    };
};

export const renderEmbedForUrl = ({ url, cast_id, castId }: CastEmbed) => {
    if (castId || cast_id) {
        return <CastEmbed castId={castId || cast_id} />;
    }
    if (!url) return null;

    if (url.includes("i.imgur.com") || url.startsWith("https://imagedelivery.net") || isImageUrl(url)) {
        return <WarpcastImage url={url} />;
    } else if (url.startsWith('"chain:')) {
        return <OnchainEmbed url={url} />;
    } else if (url.startsWith("https://stream.warpcast.com")) {
        return <VideoEmbed url={url} />;
    } else if (url.startsWith("https://warpcast.com") && !url.includes("/~/")) {
        return <CastEmbed url={url} />;
    } else if ((url.includes("twitter.com") || url.startsWith("https://x.com")) && url.includes("status/")) {
        const tweetId = url.split("/").pop();
        return tweetId ? <TweetEmbed tweetId={tweetId} /> : null;
    } else if (url.startsWith("https://nouns.build")) {
        return <NounsBuildEmbed url={url} />;
    } else if (url.includes("paragraph.xyz") || url.includes("pgrph.xyz")) {
        return <ParagraphXyzEmbed url={url} />;
    } else if (!isImageUrl(url)) {
        return <FrameEmbed url={url} />;
    } else {
        return null;
    }
};
