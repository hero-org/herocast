import React from 'react';
import { FarcasterEmbed, FarcasterUrlEmbed, isUrlEmbed, isImageEmbed } from '@/common/types/embeds';
import { Cross1Icon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type EmbedsEditorProps = {
  embeds: FarcasterEmbed[];
  setEmbeds: (embeds: FarcasterEmbed[]) => void;
  RichEmbed?: (props: { embed: FarcasterEmbed }) => React.ReactElement;
};

export const EmbedsEditor = ({ embeds, setEmbeds }: EmbedsEditorProps) => {
  if (embeds.length === 0) return null;

  return (
    <>
      {embeds.map((embed, i) => {
        // Use URL or metadata as stable key, fallback to index for loading embeds
        const embedKey = isUrlEmbed(embed) ? embed.url : `embed-${i}`;
        const isLoading = isUrlEmbed(embed) && embed.status === 'loading';

        return (
          <div key={embedKey} className="relative mt-2">
            <Button
              className="rounded-full text-foreground hover:text-muted-foreground absolute -top-2 -left-2 border z-50 h-6 w-6"
              size="icon"
              variant="outline"
              type="button"
              onClick={() => {
                setEmbeds(embeds.filter((_, j) => j !== i));
              }}
            >
              <Cross1Icon className="h-3 w-3" />
            </Button>
            {isLoading ? (
              <Skeleton className="h-[100px] w-full items-center flex justify-center">Loading...</Skeleton>
            ) : isImageEmbed(embed) && isUrlEmbed(embed) ? (
              <div className="border rounded max-w-md">
                <img
                  src={embed.url}
                  alt={(embed as FarcasterUrlEmbed).metadata?.image?.url}
                  className="rounded w-full"
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
};
