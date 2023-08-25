import { PhotoIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";

// export const VITE_IMGUR_CLIENT_ID = import.meta.env.VITE_IMGUR_CLIENT_ID

const getImageViaCdnUrl = (imgUrl: string) => {
  const fileSuffix = imgUrl.split('.').slice(-1)[0]
  return `https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_${fileSuffix}/${imgUrl}`
}

export const ImgurImage = ({ url }: { url: string }) => {
  // const [image, setImage] = useState<string | null>(null)
  // var myHeaders = new Headers();
  // myHeaders.append("Authorization", `Client-ID ${VITE_IMGUR_CLIENT_ID}`);

  // var formdata = new FormData();

  // var requestOptions = {
  //   method: 'POST',
  //   headers: myHeaders,
  //   body: formdata,
  //   redirect: 'follow' as RequestRedirect
  // };

  // const getImage = async (url: string) => {
  //   const imageHash = url.split('/').slice(-1)[0]
  //   const res: string = await fetch(`https://api.imgur.com/3/image/${imageHash}`, requestOptions)
  //     .then(response => response.json())
  //     .then(result => { console.log('res when fetching imgur image', result); return result; })
  //     .catch(error => console.log('error when fetching imgur image', error));
  //   console.log('res', res);
  //   setImage(res);
  // }

  // useEffect(() => {
  //   getImage(url)
  // }, [url])
  //
  const [isLoading, setIsLoading] = useState(true);

  const onImageLoad = (e: any) => {
    setIsLoading(false);
    e.currentTarget.style.display = 'block';
  }

  const renderLoadingPlaceholder = () => {
    return (
      <button
        type="button"
        className="mt-2 h-48 w-48 object-left relative block rounded-sm border-1 border-dashed border-gray-700 py-12 text-center"
      >
        <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
        <span className="mt-2 block text-sm font-semibold text-gray-400">Loading image...</span>
      </button>
    )
  }

  return (
    <>
      <img
        className="mt-2 h-48 md:h-72 object-left rounded-sm"
        style={{ display: 'none' }}
        src={getImageViaCdnUrl(url)}
        alt=""
        referrerPolicy="no-referrer"
        onError={(e) => {
          console.log('error loading image', e);
        }}
        onLoad={(e) => onImageLoad(e)}
      />
      {isLoading && renderLoadingPlaceholder()}
    </>
  )
}
