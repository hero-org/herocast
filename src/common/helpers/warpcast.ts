export const isWarpcastUrl = (url: string) => url.startsWith("https://warpcast.com/");
export const FARCASTER_LOGO_URL =
  "https://wrpcd.net/cdn-cgi/image/anim=false,fit=contain,f=auto,w=144/https%3A%2F%2Fipfs.decentralized-content.com%2Fipfs%2Fbafkreialf5usxssf2eu3e5ct37zzdd553d7lg7oywvdszmrg5p2zpkta7u";

type ParsedWarpcastUrl = {
  slug?: string;
  username?: string;
  channel?: string;
};

/**
 * Parses a Warpcast URL and extracts relevant information such as slug, username, or channel.
 *
 * The function supports the following URL formats:
 * - https://warpcast.com/~/conversations/{slug} -> Extracts the conversation slug.
 * - https://warpcast.com/{username}/{slug} -> Extracts the username and conversation slug.
 * - https://warpcast.com/{username} -> Extracts the profile username.
 * - https://warpcast.com/~/channel/{channel} -> Extracts the channel name.
 *
 * @param {string} url - The Warpcast URL to parse.
 * @returns {ParsedWarpcastUrl} An object containing the parsed slug, username, or channel.
 */
export const parseWarpcastUrl = (url: string): ParsedWarpcastUrl => {
  const query = url.replace("https://warpcast.com/", "");

  let slug, username, channel;
  if (query.startsWith("~/conversations/")) {
    username = query.split("/")[3];
    slug = query.split("/").pop();
  } else if (query.startsWith("~/channel")) {
    channel = query.split("/").pop();
  } else if (query.includes("/0x")) {
    slug = query;
  } else {
    username = query;
  }
  return { slug, username, channel };
};
