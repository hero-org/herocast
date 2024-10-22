import React, { useEffect, useState } from 'react';
import { CastRow } from '@/common/components/CastRow';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { CastData } from '@/common/types/types';
import orderBy from 'lodash.orderby';
import clsx from 'clsx';

interface CastReactionsTableProps {
  rawCasts: CastData[];
}

const CastReactionsTable = ({ rawCasts }: CastReactionsTableProps) => {
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
      const hashes = rawCasts.map((cast: any) => cast.hash);
      const castsResponse = await neynarClient.fetchBulkCasts(hashes);
      if (castsResponse.result.casts) {
        setCasts(orderBy(castsResponse.result.casts, 'reactions.likes_count', 'desc'));
      }
    };

    if (rawCasts?.length) {
      fetchData();
    }
  }, [rawCasts]);

  return (
    <div className="overflow-x-auto">
      {/* From the smallest screen to 767px wide */}
      <div className="w-full block md:hidden">
        {casts.map((cast) => (
          <div key={cast.hash} className="flex flex-col gap-2 border-t border-gray-200 hover:bg-foreground/10 p-4 mb-4">
            <CastRow showChannel hideAuthor hideReactions cast={cast} />
            <div className="flex items-start justify-start gap-8 px-3 text text-sm mt-2">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Likes</span>
                <span>{cast.reactions.likes_count}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Recasts</span>
                <span>{cast.reactions.recasts_count}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Type</span>
                <span>{cast.parent_hash ? 'Reply' : 'Original'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* From the 768px width to screen to the largest of screens */}
      <table className="w-full hidden md:block">
        <thead>
          <tr className="bg-card text-card-foreground uppercase text-sm leading-normal">
            <th className="py-3 px-6 text-left">Cast</th>
            <th className="py-3 px-6 text-center">Likes▼</th>
            <th className="py-3 px-6 text-center">Recasts</th>
            <th className="py-3 px-6 text-center">Type</th>
          </tr>
        </thead>
        <tbody className="text-foreground-muted text-sm font-light">
          {casts.map((cast) => (
            <tr key={cast.hash} className="border-b border-gray-200 hover:bg-foreground/10">
              <td className="px-6 text-left">
                <CastRow showChannel hideAuthor hideReactions cast={cast} />
              </td>
              <td className="py-3 px-6 text-center">{cast.reactions.likes_count}</td>
              <td className="py-3 px-6 text-center">{cast.reactions.recasts_count}</td>
              <td className="py-3 px-6 text-center">{cast.parent_hash ? 'Reply' : 'Original'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CastReactionsTable;
