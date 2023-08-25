import { trackEvent } from "@aptabase/web";

export const trackPageView = (name: string) => {
  trackEvent("page_view", { name });
}

export const trackEventWithProperties = (name: string, properties?: Record<string, string | number | boolean> | undefined) => {
  trackEvent(name, properties);
}
