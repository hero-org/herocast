import * as linkify from "linkifyjs";
import uniqBy from "lodash.uniqby";

export const getUrlsInText = (text: string): { url: string }[] => {
  const urls = linkify.find(text, "url");
  return uniqBy(urls, 'href').map((url) => ({ "url": url.href }));
}
