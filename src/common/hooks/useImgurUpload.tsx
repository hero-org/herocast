import { useState, useCallback } from "react";
import axios from "axios";

type UploadState = {
  isUploading: boolean;
  error: string | null;
  uploadProgress: number;
  image: ImgurResponse["data"] | null;
};

type ImgurResponse = {
  data: {
    id: string;
    link: string;
    width: number;
    height: number;
  };
};

export const useImgurUpload = () => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    error: null,
    uploadProgress: 0,
    image: null,
  });

  const uploadImage = useCallback(async (file: File): Promise<void> => {
    const validateFile = (file: File): boolean => {
      const validImageTypes = ["image/gif", "image/jpeg", "image/png"];
      return validImageTypes.includes(file.type);
    };

    if (!validateFile(file)) {
      setUploadState({
        isUploading: false,
        error: "That file type isn't supported. Gifs, jpegs, and pngs only.",
        uploadProgress: 0,
        image: null,
      });
      return;
    }

    setUploadState({
      isUploading: true,
      error: null,
      uploadProgress: 0,
      image: null,
    });

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await axios.post<ImgurResponse>("https://api.imgur.com/3/image", formData, {
        headers: {
          Authorization: `Client-ID ${process.env.NEXT_PUBLIC_IMGUR_CLIENT_ID}`,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadState((prev) => ({
            ...prev,
            uploadProgress: progress,
          }));
        },
      });

      setUploadState({
        isUploading: false,
        error: null,
        uploadProgress: 100,
        image: response.data.data,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setUploadState({
          isUploading: false,
          error: error.response?.data?.error || "Failed to upload",
          uploadProgress: 0,
          image: null,
        });
      } else {
        setUploadState({
          isUploading: false,
          error: (error as Error).message,
          uploadProgress: 0,
          image: null,
        });
      }
    }
  }, []);

  return {
    uploadImage,
    ...uploadState,
  };
};
