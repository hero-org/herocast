'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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
  const [manifest, setManifest] = useState<MiniAppManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decodedUrl, setDecodedUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        // Get and decode the URL from the route param
        const urlParam = params.url as string;
        if (!urlParam) {
          setError('Missing URL parameter');
          setIsLoading(false);
          return;
        }

        const decoded = decodeURIComponent(urlParam);
        setDecodedUrl(decoded);

        // Fetch the manifest from the API
        const response = await fetch(
          `/api/miniapp/manifest?url=${encodeURIComponent(decoded)}`
        );

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
  }, [params.url]);

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
          <h2 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-100">
            Failed to Load Mini App
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300">
            {error || 'Invalid URL parameter'}
          </p>
        </div>
      </div>
    );
  }

  // Success state - render the MiniAppHost
  return <MiniAppHost manifest={manifest ?? undefined} url={decodedUrl} />;
};

export default MiniAppPage;
