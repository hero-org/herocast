import packageJson from '../../../package.json';
import { getTauriVersion } from '@tauri-apps/api/app';

export const SAVE_DELAY = 500;
export const RUNNING_IN_TAURI = window.__TAURI__ !== undefined;
export const PACKAGE_VERSION = packageJson.version;
export const TAURI_VERSION = await getTauriVersion();
