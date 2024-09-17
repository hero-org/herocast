import { init, fetchQuery } from '@airstack/node';

init(process.env.NEXT_PUBLIC_AIRSTACK_API_KEY!);

export type AirstackSocialInfo = {
  socialCapitalRank: number;
  userCreatedAt: number;
  moxieEarnings: number;
};

export async function getAirstackSocialInfoForFid(fid: string): Promise<AirstackSocialInfo | null> {
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
        FarcasterMoxieEarningStats(
          input: {timeframe: LIFETIME, blockchain: ALL, filter: {entityType: {_eq: USER}, entityId: {_eq: "${fid}"}}}
        ) {
          FarcasterMoxieEarningStat {
            allEarningsAmount
          }
        }
      }`;
  try {
    const { data, error } = await fetchQuery(query);
    if (error) {
      console.error('Error fetching airstack capital score:', error);
      return null;
    }
    const socialInfo = data?.Socials?.Social?.[0];
    const moxieEarnings = data?.FarcasterMoxieEarningStats?.FarcasterMoxieEarningStat?.[0]?.allEarningsAmount;
    if (!socialInfo && !moxieEarnings) {
      return null;
    }

    return {
      socialCapitalRank: socialInfo.socialCapital.socialCapitalRank,
      userCreatedAt: socialInfo.userCreatedAtBlockTimestamp,
      moxieEarnings,
    };
  } catch (error) {
    console.error('Error fetching Airstack data:', error);
    return null;
  }
}
