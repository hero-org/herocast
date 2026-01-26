import dynamic from 'next/dynamic';
import React from 'react';

const ReactHlsPlayer = dynamic(() => import('@gumlet/react-hls-player'), {
  ssr: false,
});

const VideoEmbed = ({ url }: { url: string }) => {
  // function playVideo() {
  //   playerRef.current.play();
  // }

  // function pauseVideo() {
  //   playerRef.current.pause();
  // }

  // function toggleControls() {
  //   playerRef.current.controls = !playerRef.current.controls;
  // }

  const playerRef = React.useRef<HTMLVideoElement>(null);

  return (
    <div key={`video-embed-${url}`} className="">
      <ReactHlsPlayer
        src={url}
        autoPlay={false}
        controls={true}
        width="80%"
        height="auto"
        // @ts-expect-error - react-hls-player types expect non-null ref but React 18 refs include null
        playerRef={playerRef}
        className="rounded-md max-w-min max-h-72 object-left"
      />
    </div>
  );
};

export default VideoEmbed;
