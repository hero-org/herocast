import posthog from 'posthog-js';

export const loadPosthogAnalytics = () => {
  if (typeof window !== 'undefined') {
    // checks that we are client-side
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !process.env.NEXT_PUBLIC_POSTHOG_HOST) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_performance: true, // Autocapture web vitals (LCP, FCP, CLS, INP)
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') posthog.debug(); // debug mode in development
      },
    });

    // Catch unhandled promise rejections from PostHog recorder on iOS Safari
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.message === 'Load failed' && event.reason?.stack?.includes('recorder.js')) {
        event.preventDefault(); // Prevent the error from being logged
      }
    });

    return posthog;
  }

  return undefined;
};
