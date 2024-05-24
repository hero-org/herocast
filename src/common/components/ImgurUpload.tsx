import React, { useRef, useState } from "react";
import { ImgurClient } from "imgur";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const client = new ImgurClient({
  clientId: process.env.NEXT_PUBLIC_IMGUR_CLIENT_ID,
  clientSecret: process.env.NEXT_PUBLIC_IMGUR_CLIENT_SECRET,
});

type ImgurUploadProps = {
  onSuccess?: (string) => void;
};

const ImgurUpload = ({ onSuccess }: ImgurUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>();

  client.on("uploadProgress", (progress) => {
    console.log("uploadProgress", progress);
    setUploadProgress(progress?.percent);
  });

  const validateFile = (file: File | undefined): boolean => {
    if (!file) {
      console.error("No file selected for upload.");
      setError("No file selected for upload.");
      return false;
    }

    const validImageTypes = ["image/gif", "image/jpeg", "image/png"];
    if (file && !validImageTypes.includes(file.type)) {
      console.error("Invalid file type. Please select an image file.");
      return false;
    }

    return true;
  };

  const handleUpload = (e: React.FormEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(undefined);
    setUploadProgress(0);

    const file = e.currentTarget.files?.[0];
    if (!validateFile(file)) return;

    console.log("file", file);
    client
      .upload({ image: file?.stream() })
      .then((response) => {
        if (response.success) {
          setUploadProgress(100);
          onSuccess?.();
        } else {
          setError(`Failed to upload - ${response.data}`);
        }
        console.log("response", response);
        console.log(response.data);
      })
      .catch((err) => {
        setError(err.message);
        console.error(err);
      });
  };

  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <div className="flex w-full max-w-sm items-center space-x-2">
        <Input
          id="imgurUpload"
          type="file"
          ref={fileInputRef}
          className="h-9 pt-1.5"
          onInput={(e) => {
            handleUpload(e);
          }}
        />
        {/* <Button onClick={handleUpload} disabled={!fileInputRef.current}>
          Upload
        </Button> */}
      </div>
      {uploadProgress !== 0 && !error && (
        <Progress
          value={uploadProgress}
          indicatorClassName="bg-gradient-to-r from-green-400 to-green-600 animate-pulse"
        />
      )}
      {error && <Label className="text-red-500">{error}</Label>}
    </div>
  );
};

export default ImgurUpload;
