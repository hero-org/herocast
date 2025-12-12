import * as linkify from 'linkifyjs';
import uniqBy from 'lodash.uniqby';

export const getUrlsInText = (text: string): { url: string }[] => {
  const urls = linkify.find(text, 'url');
  return uniqBy(urls, 'href').map((url) => ({ url: url.href }));
};

export const isImageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const hasImageExt = /\.(jpeg|jpg|gif|png|webp|avif)$/i.test(parsed.pathname);
    const isImageHost = /imagedelivery\.net$/i.test(parsed.hostname);
    return hasImageExt || isImageHost;
  } catch {
    return false;
  }
};

export const formatLargeNumber = (num?: number): string => {
  if (!num) return '0';

  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 2000) {
    return (num / 1000).toFixed(1) + 'K';
  } else {
    return num.toString();
  }
};

export const formatShortcut = (shortcut: string): string => {
  // Defensive check - return empty string if shortcut is undefined or empty
  if (!shortcut) {
    return '';
  }
  return shortcut.replace(/\+/g, ' ').replace('cmd', '⌘');
};
