export const openWindow = (url: string) => {
  if (!url) return;
  url = url.match(/^https?:/) ? url : '//' + url;
  window.open(url, '_blank', 'noopener,noreferrer');
};

export const findParamInHashUrlPath = (url: string, param: string) => {
  return url
    .split('&')
    .find((item) => item.startsWith(param))
    ?.replace(`${param}=`, '');
};
