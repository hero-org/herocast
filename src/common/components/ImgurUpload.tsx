import React, { useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useImgurUpload } from "@/common/hooks/useImgurUpload";

type ImgurUploadProps = {
  onSuccess?: (string) => void;
};

const ImgurUpload = ({ onSuccess }: ImgurUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isUploading, error, uploadProgress, image } = useImgurUpload();

  const handleUpload = async (e: React.FormEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = e.currentTarget.files?.[0];
    if (file) {
      await uploadImage(file);
    }
  };

  React.useEffect(() => {
    if (image?.link) {
      onSuccess?.(image.link);
    }
  }, [image, onSuccess]);

  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <div className="flex w-full max-w-sm items-center space-x-2">
        <Input
          id="imgurUpload"
          type="file"
          ref={fileInputRef}
          className="h-9 pt-1.5"
          onInput={handleUpload}
          disabled={isUploading}
        />
      </div>
      {uploadProgress > 0 && !error && (
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
