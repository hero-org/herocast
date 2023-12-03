import { RUNNING_IN_TAURI } from "@/common/constants/tauri"
import { open } from '@tauri-apps/api/shell';

export const openWindow = (url: string) => {
  if (!url) return;

  if (RUNNING_IN_TAURI) {
    open(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export const findParamInHashUrlPath = (url: string, param: string) => {
  return url.split('&').find((item) => item.startsWith(param))?.replace(`${param}=`, '');
}
