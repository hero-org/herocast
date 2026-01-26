import axios from 'axios';
import { useCallback, useState } from 'react';

type UploadState = {
  isUploading: boolean;
  error: string | null;
  uploadProgress: number;
  image: CloudinaryImageData | null;
};

type CloudinaryImageData = {
  id: string;
  link: string;
  width: number;
  height: number;
};

type CloudinaryResponse = {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
};

export const useCloudinaryUpload = () => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    error: null,
    uploadProgress: 0,
    image: null,
  });

  const uploadImage = useCallback(async (file: File): Promise<void> => {
    const validateFile = (file: File): boolean => {
      const validImageTypes = ['image/gif', 'image/jpeg', 'image/png', 'image/webp'];
      return validImageTypes.includes(file.type);
    };

    if (!validateFile(file)) {
      setUploadState({
        isUploading: false,
        error: "That file type isn't supported. Gifs, jpegs, pngs, and webp only.",
        uploadProgress: 0,
        image: null,
      });
      return;
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      setUploadState({
        isUploading: false,
        error:
          'Cloudinary configuration is missing. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.',
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
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const response = await axios.post<CloudinaryResponse>(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData,
        {
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0;
            setUploadState((prev) => ({
              ...prev,
              uploadProgress: progress,
            }));
          },
        }
      );

      setUploadState({
        isUploading: false,
        error: null,
        uploadProgress: 100,
        image: {
          id: response.data.public_id,
          link: response.data.secure_url,
          width: response.data.width,
          height: response.data.height,
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'Failed to upload image';
        setUploadState({
          isUploading: false,
          error: errorMessage,
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
