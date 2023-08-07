import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { SAVE_DELAY } from "../constants/tauri";
import { getTauriStore } from "../helpers/tauri/storage";

export function useTauriStore(key: string, defaultValue: any, storeName = 'data.dat') {

  const [state, setState] = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const store = getTauriStore(storeName);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // useLayoutEffect will be called before DOM paintings and before useEffect
  useLayoutEffect(() => {
    let allow = true;
    store.get(key)
      .then(value => {
        if (value === null) throw '';
        if (allow) setState(value);
      }).catch(() => {
        store.set(key, defaultValue).then(() => {
          timeoutRef.current = setTimeout(() => store.save(), SAVE_DELAY)
        });
      })
      .then(() => {
        if (allow) setLoading(false);
      });
    return () => {
      allow = false;
    };
  }, []);

  useEffect(() => {
    // do not allow setState to be called before data has even been loaded!
    // this prevents overwriting
    if (!loading) {
      clearTimeout(timeoutRef.current);
      store.set(key, state).then(() => {
        timeoutRef.current = setTimeout(() => {
          store.save();
          console.log(state);
        }, SAVE_DELAY)
      });
    }
    // ensure data is saved by not clearing the timeout on unmount
  }, [state]);

  return [state, setState, loading];
}
