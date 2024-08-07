import React from 'react';
import { CastRow } from '@/common/components/CastRow';

interface CastData {
  hash: string;
  timestamp: string;
  is_reply: boolean;
  like_count: string;
  recast_count: string;
  text?: string;
  author?: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
}

interface CastReactionsTableProps {
  data: CastData[];
}

const CastReactionsTable: React.FC<CastReactionsTableProps> = ({ data }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead>
          <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
            <th className="py-3 px-6 text-left">Cast</th>
            <th className="py-3 px-6 text-center">Likes</th>
            <th className="py-3 px-6 text-center">Recasts</th>
            <th className="py-3 px-6 text-center">Type</th>
          </tr>
        </thead>
        <tbody className="text-gray-600 text-sm font-light">
          {data.map((cast) => (
            <tr key={cast.hash} className="border-b border-gray-200 hover:bg-gray-100">
              <td className="py-3 px-6 text-left">
                <CastRow
                  isEmbed
                  cast={{
                    hash: cast.hash,
                    text: cast.text || '',
                    timestamp: new Date(cast.timestamp).getTime(),
                    author: cast.author || {
                      fid: 0,
                      username: 'Unknown',
                      displayName: 'Unknown',
                      pfp: { url: '' },
                    },
                  }}
                />
              </td>
              <td className="py-3 px-6 text-center">{cast.like_count}</td>
              <td className="py-3 px-6 text-center">{cast.recast_count}</td>
              <td className="py-3 px-6 text-center">
                {cast.is_reply ? 'Reply' : 'Original'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CastReactionsTable;
