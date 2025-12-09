import React from 'react';
import { Embed, isImageEmbed } from '@mod-protocol/core';
import { Cross1Icon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type EmbedsEditorProps = {
  embeds: Embed[];
  setEmbeds: (embeds: Embed[]) => void;
  RichEmbed?: (props: { embed: Embed }) => React.ReactElement;
};

export const EmbedsEditor = ({ embeds, setEmbeds }: EmbedsEditorProps) => {
  if (embeds.length === 0) return null;

  return (
    <>
      {embeds.map((embed, i) => (
        <div key={i} className="relative mt-2">
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
          {embed.status === 'loading' ? (
            <Skeleton className="h-[100px] w-full items-center flex justify-center">Loading...</Skeleton>
          ) : isImageEmbed(embed) && 'url' in embed ? (
            <div className="border rounded">
              <img
                src={(embed as { url: string }).url}
                alt={(embed.metadata as any)?.alt}
                className="rounded"
                style={{ width: '100%' }}
              />
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
};
