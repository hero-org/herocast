export type IcebreakerSocialInfo = {
  channels: {
    type: string;
    isVerified: boolean;
    isLocked: boolean;
    value: string;
    url: string;
  }[];
  credentials: {
    name: string;
    chain?: string;
    source?: string;
    reference?: string;
  }[];
};

export async function getIcebreakerSocialInfoForFid(
  fid: string,
): Promise<IcebreakerSocialInfo | null> {
  try {
    const response = await fetch(
      `https://app.icebreaker.xyz/api/v1/fid/${fid}`,
      {
        headers: {
          accept: "application/json",
        },
      },
    );
    const data = await response.json();
    if (data && data.profiles && data?.profiles.length === 1) {
      const profile = data.profiles[0];
      return {
        channels: profile?.channels || [],
        credentials: profile?.credentials || [],
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching Icebreaker data:", error);
    return null;
  }
}
