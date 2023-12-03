import React from 'react';
import { Tweet } from 'react-tweet'

interface TweetEmbedProps {
  tweetId: string;
}

const TweetEmbed: React.FC<TweetEmbedProps> = ({ tweetId }) => {
  return (
    <div key={`tweet-embed-${tweetId}`} className="dark">
      <Tweet id={tweetId} />
    </div>
  );
};

export default TweetEmbed;
