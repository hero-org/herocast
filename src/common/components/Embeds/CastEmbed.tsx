import React, { useEffect, useState } from 'react';
import { CastRow } from '../CastRow';
import isEmpty from 'lodash.isempty';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';

type CastEmbedProps = {
  url?: string;
  castId?: { hash: string; fid: number };
  hideReactions?: boolean;
};

const CastEmbed = ({ url, castId, hideReactions }: CastEmbedProps) => {
  const [cast, setCast] = useState<CastWithInteractions | null>(null);

  useEffect(() => {
    const getData = async () => {
      try {
        let identifier: string;
        let type: 'hash' | 'url';

        if (url) {
          identifier = url;
          type = 'url';
        } else if (castId) {
          identifier = castId.hash;
          type = 'hash';
        } else {
          return;
        }

        const params = new URLSearchParams({
          identifier,
          type,
        });

        const response = await fetch(`/api/casts/lookup?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const res = await response.json();
        if (res && res.cast) {
          setCast(res.cast);
        }
      } catch (err) {
        console.log(`Error in CastEmbed: ${err} ${url} ${castId}`);
      }
    };

    getData();
  }, []);

  if ((!url && !castId) || isEmpty(cast)) return null;

  return (
    <div key={`cast-embed-${url}`} className="border border-foreground/30 rounded-lg">
      <CastRow cast={cast} hideReactions={hideReactions} showChannel isEmbed />
    </div>
  );
};

export default CastEmbed;
