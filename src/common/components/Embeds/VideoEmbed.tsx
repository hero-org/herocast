import React from "react";

import dynamic from "next/dynamic";
const ReactHlsPlayer = dynamic(() => import("@gumlet/react-hls-player"), {
  ssr: false,
});

const VideoEmbed = ({ url }: { url: string }) => {
  const playerRef = React.useRef();
  // function playVideo() {
  //   playerRef.current.play();
  // }

  // function pauseVideo() {
  //   playerRef.current.pause();
  // }

  // function toggleControls() {
  //   playerRef.current.controls = !playerRef.current.controls;
  // }

  return (
    <div key={`video-embed-${url}`} className="">
      <ReactHlsPlayer
        src={url}
        autoPlay={false}
        controls={true}
        width="80%"
        height="auto"
        playerRef={playerRef}
        className="rounded-md max-w-min max-h-72 object-left"
      />
    </div>
  );
};

export default VideoEmbed;
