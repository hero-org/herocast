import React, { useState } from "react";
import { PhotoIcon } from "@heroicons/react/24/solid";

const getImageViaCdnUrl = (imgUrl: string) => {
  if (imgUrl.startsWith("https://imagedelivery.net")) return imgUrl;

  if (imgUrl.includes("imgur.com")) {
    const fileSuffix = imgUrl.split(".").slice(-1)[0];
    return `https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_${fileSuffix}/${imgUrl}`;
  }
  return imgUrl;
};

export const WarpcastImage = ({ url }: { url: string }) => {
  const [isLoading, setIsLoading] = useState(true);

  const onImageLoad = (e: any) => {
    setIsLoading(false);
    e.currentTarget.style.display = "block";
  };

  const renderLoadingPlaceholder = () => {
    return (
      <button
        type="button"
        className="h-48 w-48 object-left relative block rounded-sm border-1 border-dashed border-gray-700 py-12 text-center"
      >
        <PhotoIcon className="mx-auto h-12 w-12 text-foreground/70" />
        <span className="block text-sm font-semibold text-foreground/70">
          Loading image...
        </span>
      </button>
    );
  };

  return (
    <>
      <img
        className="mt-2 max-h-48 md:max-h-72 object-left rounded-md"
        style={{ display: "none" }}
        src={getImageViaCdnUrl(url)}
        alt=""
        referrerPolicy="no-referrer"
        onError={(e) => {
          console.log("error loading image", e);
        }}
        onLoad={(e) => onImageLoad(e)}
      />
      {isLoading && renderLoadingPlaceholder()}
    </>
  );
};
