import { trackEvent } from "@aptabase/web";

export const trackPageView = (name: string) => {
  trackEvent("page_view", { name });
}
