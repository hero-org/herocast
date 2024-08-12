import axios from "axios";

export async function makeGraphqlRequest<T>(
  url: string,
  query: string,
  variables: any,
): Promise<T> {
  return await axios
    .post(
      url,
      {
        query,
        variables,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    )
    .then((response) => response.data.data)
    .catch((err) => {
      throw {
        error: err,
      };
    });
}
