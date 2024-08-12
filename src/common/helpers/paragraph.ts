export type ParagraphXyzArticleType = {
  publication: {
    createdAt: number;
    author_name: string;
    name: string;
    url: string;
    summary: string;
  };
  user: {
    authorName: string;
    avatar_url: string;
    wallet_address: string;
  };
  post: {
    title: string;
    subtitle: string;
    post_preview: string;
    createdAt: number;
    publishedAt: number;
    updatedAt: number;
    url: string;
    cover_img?: {
      img: {
        src: string;
        width: number;
        height: number;
      };
      isHero: boolean;
      base64: string;
    };
  };
};

const PARAGRAPH_XYZ_ARTICLE_ENDPOINT = "https://paragraph.xyz/api/v2/blogs/";

export const getParagraphXyzArticle = async (
  url: string,
): Promise<ParagraphXyzArticleType | null> => {
  // asumes url to have format: https://paragraph.xyz/@{author}/{post-title}
  const articleSlug = url.split("?")[0].split("@")[1];
  if (!articleSlug) {
    return null;
  }
  try {
    const response = await fetch(
      `${PARAGRAPH_XYZ_ARTICLE_ENDPOINT}@${articleSlug}`,
    );
    return await response.json();
  } catch (error) {
    console.error(`failed to fetch pargraph data for URL: ${url}`, error);
    return null;
  }
};
