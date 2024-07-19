import { init, fetchQuery } from "@airstack/node";

init(process.env.NEXT_PUBLIC_AIRSTACK_API_KEY!);

export async function getSocialCapitalScore(fid: string) {
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
          }
        }
      }`;

    const { data, error } = await fetchQuery(query);
    if (error) {
        console.error("Error fetching airstack capital score:", error);
        return undefined;
    }
    return data.Socials.Social[0].socialCapital;
}
