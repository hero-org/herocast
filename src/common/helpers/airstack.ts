import { init, fetchQuery } from "@airstack/node";

init(process.env.NEXT_PUBLIC_AIRSTACK_API_KEY!);

export async function getTokenBalances(address: string) {
  const query = `
    query MyQuery {
      TokenBalances(
        input: {filter: {owner: {_eq: "${address}"}, tokenType: {_in: [ERC20, ERC721, ERC1155]}}, blockchain: ethereum, limit: 50}
      ) {
        TokenBalance {
          amount
          formattedAmount
          tokenAddress
          token {
            name
            symbol
            decimals
            totalSupply
            logo {
              small
            }
          }
        }
      }
    }
  `;

  const { data, error } = await fetchQuery(query);

  if (error) {
    throw new Error(error.message);
  }

  return data.TokenBalances.TokenBalance;
}

export async function getNFTsOwned(address: string) {
  const query = `
    query MyQuery {
      NFTs(
        input: {filter: {owner: {_eq: "${address}"}}, blockchain: ethereum, limit: 50}
      ) {
        NFT {
          address
          tokenId
          tokenType
          contentType
          contentValue {
            image {
              original
            }
          }
          token {
            name
            symbol
          }
        }
      }
    }
  `;

  const { data, error } = await fetchQuery(query);

  if (error) {
    throw new Error(error.message);
  }

  return data.NFTs.NFT;
}
