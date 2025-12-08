/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { PhotoIcon } from '@heroicons/react/24/solid';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';

const getImageViaCdnUrl = (imgUrl: string, skipCdn: boolean) => {
  // Cloudinary URLs are already CDN-optimized, return as-is
  if (imgUrl.includes('res.cloudinary.com')) return imgUrl;
  if (imgUrl.startsWith('https://imagedelivery.net')) return imgUrl;

  // Legacy imgur URLs: proxy through Cloudinary for reliability
  if (!skipCdn && imgUrl.includes('imgur.com')) {
    const fileSuffix = imgUrl.split('.').slice(-1)[0];
    return `https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_${fileSuffix}/${imgUrl}`;
  }
  return imgUrl;
};

export const WarpcastImage = ({ url }: { url: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [skipCdn, setSkipCdn] = useState(false);

  const onImageLoad = (e: any) => {
    setIsLoading(false);
    e.currentTarget.style.display = 'block';
  };

  const renderLoadingPlaceholder = () => {
    return (
      <Skeleton className="h-36 w-48 object-left relative block rounded-lg py-10 text-center">
        <PhotoIcon className="mx-auto h-12 w-12 text-foreground/70" />
        <Label>Loading image...</Label>
      </Skeleton>
    );
  };

  return (
    <div>
      <img
        className="max-h-48 md:max-h-72 object-left rounded-md"
        style={{ display: 'none' }}
        src={getImageViaCdnUrl(url, skipCdn)}
        alt=""
        referrerPolicy="no-referrer"
        onError={(e) => {
          if (skipCdn) return;

          console.log('error loading image, retry without CDN', url);
          setSkipCdn(true);
        }}
        onLoad={(e) => onImageLoad(e)}
      />
      {isLoading && renderLoadingPlaceholder()}
    </div>
  );
};
