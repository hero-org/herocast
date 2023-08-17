// based on https://tauri.app/v1/guides/features/splashscreen/
//
import { invoke } from '@tauri-apps/api/tauri'

export const WaitForAppLoaded = () => {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded')
    // This will wait for the window to load, but you could
    // run this function on whatever trigger you want
    invoke('close_splashscreen')
  })
  return <></>;
}
