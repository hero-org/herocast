import React, { useState, useEffect } from 'react';

const OpenGraphImage = ({ url }: { url: string }) => {
  const [metadata, setMetadata] = useState(null);

  useEffect(() => {
    fetch("https://api.modprotocol.org/api/cast-embeds-metadata/by-url", {
      body: JSON.stringify([url]),
      method: 'POST',
      headers: {
        'Content-Type': "application/json"
      }
    })
    .then(response => response.json())
    .then(data => setMetadata(data))
    .catch(error => console.error('Error:', error));
  }, [url]);

  return metadata ? <img src={metadata.open_graph_image_url} alt="Open Graph Image" /> : null;
};

export default OpenGraphImage;
