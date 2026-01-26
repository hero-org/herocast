'use client';

import type React from 'react';
import {
  enrichTweet,
  TweetBody,
  TweetContainer,
  TweetHeader,
  TweetInReplyTo,
  TweetMedia,
  TweetSkeleton,
  type TwitterComponents,
  useTweet,
} from 'react-tweet';
import type { Tweet } from 'react-tweet/api';

type Props = {
  tweet: Tweet;
  components?: TwitterComponents;
};

export const MyTweet = ({ tweet: t, components }: Props) => {
  const tweet = enrichTweet(t);
  return (
    <div id="herocast-tweet-container">
      <TweetContainer className="w-full p-0 text-sm">
        <TweetHeader tweet={tweet} components={components} />
        {tweet.in_reply_to_status_id_str && <TweetInReplyTo tweet={tweet} />}
        <TweetBody tweet={tweet} />
        {tweet.mediaDetails?.length ? <TweetMedia tweet={tweet} components={components} /> : null}
        {/* {tweet.quoted_tweet && <QuotedTweet tweet={tweet.quoted_tweet} />} */}
        {tweet.quoted_tweet && (
          <TweetContainer className="w-full p-0">
            <TweetHeader tweet={tweet.quoted_tweet} components={components} />
            {tweet.quoted_tweet.in_reply_to_status_id_str && <TweetInReplyTo tweet={tweet.quoted_tweet} />}
            <TweetBody tweet={tweet.quoted_tweet} />
          </TweetContainer>
        )}

        {/* <TweetInfo tweet={tweet} /> */}
        {/* <TweetActions tweet={tweet} /> */}
        {/* We're not including the `TweetReplies` component that adds the reply button */}
      </TweetContainer>
    </div>
  );
};

interface TweetEmbedProps {
  tweetId: string;
}

const TweetEmbed: React.FC<TweetEmbedProps> = ({ tweetId }) => {
  const { data, error, isLoading } = useTweet(tweetId);

  if (isLoading) return <TweetSkeleton />;
  if (error || !data) {
    return <TweetSkeleton />;
  }
  return (
    <div key={`tweet-embed-${tweetId}`} className="dark">
      <MyTweet tweet={data} />
    </div>
  );
};

export default TweetEmbed;
