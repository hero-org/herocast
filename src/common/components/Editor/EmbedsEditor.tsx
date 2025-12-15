import React from 'react';
import { FarcasterEmbed, FarcasterUrlEmbed, isUrlEmbed, isImageEmbed } from '@/common/types/embeds';
import { Cross1Icon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import OpenGraphImage from '@/common/components/Embeds/OpenGraphImage';
import { cn } from '@/lib/utils';

type EmbedsEditorProps = {
  embeds: FarcasterEmbed[];
  setEmbeds: (embeds: FarcasterEmbed[]) => void;
  removeEmbed?: (url: string) => void;
  RichEmbed?: (props: { embed: FarcasterEmbed }) => React.ReactElement;
};

export const EmbedsEditor = ({ embeds, setEmbeds, removeEmbed }: EmbedsEditorProps) => {
  if (embeds.length === 0) return null;

  // Separate images from link embeds for different layouts
  const imageEmbeds = embeds.filter((e) => isUrlEmbed(e) && isImageEmbed(e));
  const linkEmbeds = embeds.filter((e) => isUrlEmbed(e) && !isImageEmbed(e));

  return (
    <div className="space-y-3">
      {/* Link embeds in a responsive grid */}
      {linkEmbeds.length > 0 && (
        <div className={cn('grid gap-2', linkEmbeds.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
          {linkEmbeds.map((embed, i) => {
            const embedKey = isUrlEmbed(embed) ? embed.url : `link-${i}`;
            return (
              <div key={embedKey} className="relative group min-w-0">
                <Button
                  className="rounded-full text-foreground hover:text-muted-foreground absolute -top-2 -right-2 border z-50 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  size="icon"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    if (removeEmbed && isUrlEmbed(embed)) {
                      removeEmbed(embed.url);
                    } else {
                      const idx = embeds.indexOf(embed);
                      setEmbeds(embeds.filter((_, j) => j !== idx));
                    }
                  }}
                >
                  <Cross1Icon className="h-2.5 w-2.5" />
                </Button>
                {isUrlEmbed(embed) && <OpenGraphImage url={embed.url} skipIntersection compact />}
              </div>
            );
          })}
        </div>
      )}

      {/* Image embeds */}
      {imageEmbeds.length > 0 && (
        <div className={cn('grid gap-2', imageEmbeds.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
          {imageEmbeds.map((embed, i) => {
            const embedKey = isUrlEmbed(embed) ? embed.url : `img-${i}`;
            return (
              <div key={embedKey} className="relative group">
                <Button
                  className="rounded-full text-foreground hover:text-muted-foreground absolute top-1 right-1 border z-50 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80"
                  size="icon"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    if (removeEmbed && isUrlEmbed(embed)) {
                      removeEmbed(embed.url);
                    } else {
                      const idx = embeds.indexOf(embed);
                      setEmbeds(embeds.filter((_, j) => j !== idx));
                    }
                  }}
                >
                  <Cross1Icon className="h-2.5 w-2.5" />
                </Button>
                {isUrlEmbed(embed) && (
                  <div className="border rounded overflow-hidden">
                    <img
                      src={embed.url}
                      alt={(embed as FarcasterUrlEmbed).metadata?.image?.url}
                      className="rounded w-full h-auto max-h-48 object-cover"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
