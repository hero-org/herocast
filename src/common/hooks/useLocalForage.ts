import localforage from "localforage";
import { useEffect, useLayoutEffect, useState } from "react";

export function useLocalForage(key: string, defaultValue: unknown) {

  const [state, setState] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    let allow = true;
    localforage.getItem(key)
      .then(value => {
        if (value === null || value === undefined) value = defaultValue;
        if (allow) setState(value);
      })
      .catch(() => localforage.setItem(key, defaultValue))
      .then(() => {
        if (allow) setLoading(false);
      });
    return () => {
      allow = false
    }
  }, []);

  useEffect(() => {
      if (!loading) localforage.setItem(key, state);
  }, [state]);

  return [state, setState, loading];
}
