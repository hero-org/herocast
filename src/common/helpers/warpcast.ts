export const isWarpcastUrl = (url: string) => url.startsWith("https://warpcast.com/");
export const FARCASTER_LOGO_URL = "https://wrpcd.net/cdn-cgi/image/anim=false,fit=contain,f=auto,w=144/https%3A%2F%2Fipfs.decentralized-content.com%2Fipfs%2Fbafkreialf5usxssf2eu3e5ct37zzdd553d7lg7oywvdszmrg5p2zpkta7u"

type ParsedWarpcastUrl = {
    slug?: string;
    username?: string;
    channel?: string;
};


export const parseWarpcastUrl = (url: string): ParsedWarpcastUrl => {
    const query = url.replace("https://warpcast.com/", "");
    // https://warpcast.com/~/conversations/0xa98f28f9818fd2179b26191e42903386c0a1aaec to cast
    // https://warpcast.com/linda/0x01c360e4 to cast
    // https://warpcast.com/metaend.eth to profile
    // https://warpcast.com/~/channel/memes to channel

    let slug, username, channel;
    if (query.startsWith("~/conversations/")) {
        username = query.split("/")[3];
        slug = query.split("/").pop();
    } else if (query.startsWith('~/channel')) {
        channel = query.split("/").pop();
    } else if (query.includes('/0x')) {
        slug = query
    } else {
        username = query;
    }
    return { slug, username, channel };
};