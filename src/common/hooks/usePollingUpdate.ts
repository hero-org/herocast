import { useEffect, useState } from "react";

const usePollingUpdate = (pollingFunction: (() => void) | null, interval: number) => {
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (!pollingFunction) return;

    const id = setInterval(pollingFunction, interval)
    setSubscription(id)
    return () => {
      if (subscription) {
        clearInterval(subscription);
      }
    }
  }, [pollingFunction])
}


export default usePollingUpdate;
