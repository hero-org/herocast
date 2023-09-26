import React from 'react';
import Tweet from 'react-tweet';

interface TweetEmbedProps {
  tweetId: string;
}

const TweetEmbed: React.FC<TweetEmbedProps> = ({ tweetId }) => {
  return <Tweet id={tweetId} />;
};

export default TweetEmbed;
