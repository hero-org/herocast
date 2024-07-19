import { init, fetchQuery } from "@airstack/node";

init("YOUR_AIRSTACK_API_KEY");

const getSocialCapitalScore = async () => {
    const query = `query MyQuery {
    Socials(
      input: {
        filter: {
          dappName: {
            _eq: farcaster
          },
          identity: { _eq: "fc_fid:602" }
        },
        blockchain: ethereum
      }
    ) {
      Social {
        socialCapital {
          socialCapitalScoreRaw
          socialCapitalScore
        }
      }
    }
  }`;

    const { data, error } = await fetchQuery(query);

    console.log("data:", data);
    console.log("error:", error);
    return data["Socials"][0]["Social"]["socialCapital"];
}
