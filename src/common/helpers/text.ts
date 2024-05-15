import * as linkify from "linkifyjs";
import uniqBy from "lodash.uniqby";

export const getUrlsInText = (text: string): { url: string }[] => {
  const urls = linkify.find(text, "url");
  return uniqBy(urls, 'href').map((url) => ({ "url": url.href }));
}

export const isImageUrl = (url: string): boolean => {
  return url.match(/\.(jpeg|jpg|gif|png)$/) != null;
}

export const formatLargeNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  } else if (num >= 2000) {
    return (num / 1000).toFixed(1) + "K";
  } else {
    return num.toString();
  }
}