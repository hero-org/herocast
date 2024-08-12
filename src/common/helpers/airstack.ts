import { init, fetchQuery } from "@airstack/node";

init(process.env.NEXT_PUBLIC_AIRSTACK_API_KEY!);

export type AirstackSocialInfo = {
  socialCapitalRank: number;
  userCreatedAt: number;
};

export async function getAirstackSocialInfoForFid(
  fid: string,
): Promise<AirstackSocialInfo | null> {
  const query = `query MyQuery {
        Socials(
          input: {
            filter: {
              dappName: {
                _eq: farcaster
              },
              identity: { _eq: "fc_fid:${fid}" }
            },
            blockchain: ethereum
          }
        ) {
          Social {
            socialCapital {
                socialCapitalRank
            }
            userCreatedAtBlockTimestamp
          }
        }
      }`;
  try {
    const { data, error } = await fetchQuery(query);
    if (error) {
      console.error("Error fetching airstack capital score:", error);
      return null;
    }
    const socialInfo = data?.Socials?.Social?.[0];
    if (!socialInfo) {
      return null;
    }

    return {
      socialCapitalRank: socialInfo.socialCapital.socialCapitalRank,
      userCreatedAt: socialInfo.userCreatedAtBlockTimestamp,
    };
  } catch (error) {
    console.error("Error fetching Airstack data:", error);
    return null;
  }
}
