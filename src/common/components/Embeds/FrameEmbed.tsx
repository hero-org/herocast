import React, { useEffect, useState } from "react";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v1";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "react-hotkeys-hook";
import { openWindow } from "@/common/helpers/navigation";

const renderFrame = (
  frame: any,
  isSelected: boolean,
  hasHotkeys: boolean = false
) => {
  const [isLoading, setIsLoading] = useState(true);
  const buttonCount = frame.buttons.length;

  useHotkeys(
    "1",
    () => {
      onClickButton(0);
    },
    [isSelected, hasHotkeys],
    {
      enabled: isSelected,
      enableOnFormTags: false,
      preventDefault: true,
    }
  );

  useHotkeys(
    "2",
    () => {
      onClickButton(1);
    },
    [isSelected, hasHotkeys],
    {
      enabled: isSelected,
      enableOnFormTags: false,
      preventDefault: true,
    }
  );

  useHotkeys(
    "3",
    () => {
      onClickButton(2);
    },
    [isSelected, hasHotkeys],
    {
      enabled: isSelected,
      enableOnFormTags: false,
      preventDefault: true,
    }
  );

  const onImageLoad = (e: any) => {
    setIsLoading(false);
    e.currentTarget.style.display = "block";
  };

  const onClickButton = (index: number) => {
    console.log("clicked button", index);
    const button = frame.buttons[index];
    if (!button) return;

    switch (button.action_type) {
      case "post_redirect":
        openWindow(frame.frames_url);
        break;
      case "post":
        break;
      default:
        console.log("unknown button type", button.typaction_typee);
        break;
    }
  };

  const renderLoadingPlaceholder = () => {
    return (
      <button
        type="button"
        className="mt-2 h-48 w-48 object-left relative block rounded-sm border-1 border-dashed border-gray-700 py-12 text-center"
      >
        🖼️
        <span className="mt-2 block text-sm font-semibold text-gray-400">
          Loading Farcaster frame...
        </span>
      </button>
    );
  };

  return (
    <div className="text-xl text-gray-400">
      <img
        className="h-full object-cover max-h-48"
        style={{ display: "none" }}
        src={frame.image}
        alt={`Frame for ${frame.post_url}`}
        onLoad={(e) => onImageLoad(e)}
      />
      {isLoading ? (
        renderLoadingPlaceholder()
      ) : (
        <div className="flex flex-row gap-x-4 mt-2">
          {frame.buttons.map((button, index) => {
            const isButtonEnabled = button.action_type === "post_redirect";
            return (
              <Button
                key={`frame-button-${button.index}`}
                disabled={!isButtonEnabled}
                variant={isButtonEnabled ? "default" : "secondary"}
              >
                {button.title}
                {hasHotkeys && (
                  <kbd className="ml-2 px-1.5 py-1 text-xs border rounded-md bg-gray-700 text-gray-300 border-gray-600">
                    {index + 1}
                  </kbd>
                )}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const FrameEmbed = ({
  cast,
  isSelected,
}: {
  cast: CastWithInteractions & { frames?: any[] };
  isSelected: boolean;
}) => {
  if (!cast.frames || cast.frames.length === 0) return null;

  const nrFrames = cast.frames.length;
  return (
    <div className="mt-4">
      {cast.frames.map((frame, idx) => (
        <div key={`frame-${frame.index}`} className="mt-4">
          {renderFrame(frame, isSelected, nrFrames === 1)}
        </div>
      ))}
    </div>
  );
};

export default FrameEmbed;
