import { atom } from 'jotai'

export const atomWithLocalStorage = (key: string, initialValue: any) => {
  const getInitialValue = () => {
    const item = localStorage.getItem(key)
    if (item !== null) {
      return JSON.parse(item)
    }
    return initialValue
  }
  const baseAtom = atom(getInitialValue())
  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      const nextValue =
        typeof update === 'function' ? update(get(baseAtom)) : update
      set(baseAtom, nextValue)
      localStorage.setItem(key, JSON.stringify(nextValue))
    }
  )
  return derivedAtom
}

export const ACCOUNTS_ATOM_KEY = 'accounts'
export const MAIN_NAVIGATION_ATOM_KEY = 'main-window'

export const enum MAIN_NAVIGATION_ENUM {
  ADD_ACCOUNT = 'add-account',
  FEED = 'feed',
  REPLIES = 'replies',
  NEW_POST = 'new-post',
  SETTINGS = 'settings',
}

export const mainNavigationAtom = atomWithLocalStorage(MAIN_NAVIGATION_ATOM_KEY, '')
