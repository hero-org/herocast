import React from "npm:react";
import { render, Button, Html, Head, Preview, Body, Container, Section, Text, Link, Tailwind, Img } from "npm:@react-email/components";

const CastRow = ({ cast, searchTerm }) => {
  const pfpUrl = cast.author.pfp_url || cast.author.pfp?.url;
  const displayName = cast.author.display_name || cast.author.displayName;

  const highlightSearchTerm = (text, term) => {
    if (!term) return text;

    // Handle "term1 OR term2" format
    const orTerms = term.match(/"([^"]+)"\s+OR\s+"([^"]+)"/);
    if (orTerms) {
      const searchTerms = orTerms.slice(1).map(t => t.trim());
      const pattern = new RegExp(`(${searchTerms.join('|')})`, 'gi');
      const parts = text.split(pattern);
      return parts.map((part, index) =>
        searchTerms.some(t => part.toLowerCase() === t.toLowerCase())
          ? <strong key={index}>{part}</strong>
          : part
      );
    }

    const searchTerms = term.split(/\s+/)
      .filter(t => !t.startsWith('-'))
      .map(t => t.replace(/^["']|["']$/g, '').trim());
    const pattern = new RegExp(`(${searchTerms.join('|')})`, 'gi');
    const parts = text.split(pattern);
    return parts.map((part, index) =>
      searchTerms.some(t => part.toLowerCase() === t.toLowerCase())
        ? <strong key={index}>{part}</strong>
        : part
    );
  };

  return (
    <div className="mb-2 p-4 bg-[#fafafa] rounded-lg shadow">
      <div className="flex items-center mb-2">
        <Img
          src={`https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_144/${pfpUrl}`}
          width="16"
          height="16"
          className="rounded-full mr-1"
        />
        <Text className="font-semibold text-[#18181b]">{displayName}</Text>
        <Text className="text-[#6b7280] ml-2">@{cast.author.username}</Text>
      </div>
      <Text className="text-sm mb-2">{highlightSearchTerm(cast.text, searchTerm)}</Text>
      {cast.embeds && cast.embeds.length > 0 && (
        <div className="mb-2">
          {cast.embeds.map((embed, index) => (
            <Img
              key={index}
              src={embed.url}
              width="100%"
              height="auto"
              className="rounded-lg"
            />
          ))}
        </div>
      )}
      <div className="flex justify-between text-xs text-[#6b7280]">
        <Text>{cast.reactions?.likes_count || 0} Likes</Text>
        <Text>{cast.reactions?.recasts_count || 0} Recasts</Text>
        <Text>{cast.replies?.count || 0} Replies</Text>
      </div>
      <Button href={`https://app.herocast.xyz/conversation/${cast.hash}`} className="mt-2 rounded-md text-sm font-medium">
        View on herocast
      </Button>
    </div>
  );
};

const Email = ({ listsWithCasts }) => {
  return (
    <Html>
      <Head />
      <Preview>Your daily digest from herocast</Preview>
      <Tailwind>
        <Body className="bg-[#fdfdfd] text-[#0a0a0b] font-sans">
          <Container className="mx-auto p-8 max-w-2xl">
            <Text className="text-3xl font-bold mb-6 text-[#18181b]">Your Daily Digest from herocast</Text>
            {listsWithCasts.map(({ listName, searchTerm, casts }) => (
              <Section key={listName} className="mb-8">
                <Text className="text-2xl font-semibold mb-4 text-[#18181b]">{listName}</Text>
                {casts.length > 0 ? (
                  casts.map((cast) => <CastRow key={cast.hash} cast={cast} searchTerm={searchTerm} />)
                ) : (
                  <Text className="text-sm italic text-gray-500">No new casts in this list today.</Text>
                )}
              </Section>
            ))}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export const getHtmlEmail = (props) => render(<Email {...props} />);
