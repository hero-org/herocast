import posthog from "posthog-js"

export const loadPosthogAnalytics = () => {
    if (typeof window !== 'undefined') { // checks that we are client-side
        if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !process.env.NEXT_PUBLIC_POSTHOG_HOST) return;

        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
            // loaded: (posthog) => {
            //   if (process.env.NODE_ENV === 'development') posthog.debug() // debug mode in development
            // },
        })
    }
    return posthog;
}
