import React, { useEffect, useState } from 'react';

const OpenGraphImage = ({ url }: { url: string }) => {
  const [metadata, setMetadata] = useState(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      const request = await fetch("https://api.modprotocol.org/api/cast-embeds-metadata/by-url", {
        body: JSON.stringify([url]),
        method: 'POST',
        headers: {
          'Content-Type': "application/json"
        }
      });
      const metadata = await request.json();
      setMetadata(metadata);
    };

    fetchMetadata();
  }, [url]);

  if (!metadata) {
    return null;
  }

  return (
    <div>
      <h3>{metadata.title}</h3>
      <img src={metadata.image} alt={metadata.title} />
      <p>{metadata.description}</p>
    </div>
  );
};

export default OpenGraphImage;
