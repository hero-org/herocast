'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loading } from '@/common/components/Loading';
import MiniAppHost from '@/common/components/MiniApp/MiniAppHost';

// Type for manifest - matches the API response
type MiniAppManifest = {
  name: string;
  iconUrl: string;
  splashImageUrl?: string;
  splashBackgroundColor?: string;
  homeUrl: string;
  webhookUrl?: string;
};

type ManifestResponse = {
  manifest: MiniAppManifest | null;
  error?: string;
};

const MiniAppPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const [manifest, setManifest] = useState<MiniAppManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decodedUrl, setDecodedUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        // Check for URL in query params first (easier to use), then fall back to path param
        // Query param: /miniapp?url=https://vibes.engineering (recommended)
        // Path param: /miniapp/https%3A%2F%2Fvibes.engineering (legacy)
        const queryUrl = searchParams.get('url');
        // With catch-all route [[...url]], params.url is an array or undefined
        const pathSegments = params.url as string[] | undefined;
        const pathParam = pathSegments?.join('/');

        let decoded: string;
        if (queryUrl) {
          // Query param is automatically decoded by browser
          decoded = queryUrl;
        } else if (pathParam) {
          // Path param needs manual decoding
          decoded = decodeURIComponent(pathParam);
        } else {
          setError('Missing URL parameter. Use /miniapp?url=https://example.com');
          setIsLoading(false);
          return;
        }

        setDecodedUrl(decoded);

        // Fetch the manifest from the API
        const response = await fetch(`/api/miniapp/manifest?url=${encodeURIComponent(decoded)}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data: ManifestResponse = await response.json();

        // Manifest is optional - we can still load the mini app without it
        setManifest(data.manifest);
      } catch (err) {
        console.error('Error fetching manifest:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchManifest();
  }, [params.url, searchParams]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loading />
      </div>
    );
  }

  // Error state
  if (error || !decodedUrl) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
          <h2 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-100">Failed to Load Mini App</h2>
          <p className="text-sm text-red-700 dark:text-red-300">{error || 'Invalid URL parameter'}</p>
        </div>
      </div>
    );
  }

  // Success state - render the MiniAppHost
  return <MiniAppHost manifest={manifest ?? undefined} url={decodedUrl} />;
};

export default MiniAppPage;
