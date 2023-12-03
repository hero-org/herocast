import React, { useEffect, useState } from "react";
import {
  ParagraphXyzArticleType,
  getParagraphXyzArticle,
} from "../../helpers/paragraph";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { openWindow } from "@/common/helpers/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
type ParagraphXyzEmbedProps = {
  url: string;
};

const ParagraphXyzEmbed: React.FC<ParagraphXyzEmbedProps> = ({ url }) => {
  const [data, setData] = useState<ParagraphXyzArticleType>();

  useEffect(() => {
    const getData = async () => {
      const resp = await getParagraphXyzArticle(url);
      if (resp) {
        setData(resp);
      }
    };

    getData();
  }, []);

  if (!data) {
    return;
  }

  const renderPost = () => (
    <Card>
      <CardHeader>
        <CardTitle>{data.post.title} on Paragraph</CardTitle>
        <CardDescription>
          <div className="flex justify-between space-x-3">
            <div className="flex flex-1 space-x-1 justify-between">
              <div className="flex-shrink-0 justify-center flex flex-col">
                <Avatar>
                  <AvatarImage src={data.user.avatar_url} />
                  <AvatarFallback>
                    {data.user.authorName || data.publication.name}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="ml-2 flex-1 min-w-0 flex flex-col justify-center -space-y-0.5">
                <div className="flex flex-row space-x-2">
                  {data.user.authorName}
                </div>
                <div className="flex flex-row space-x-2">
                  published on{" "}
                  {new Date(Number(data.post.createdAt)).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="max-w-lg">{data.post.post_preview}</p>
      </CardContent>
      <CardFooter onClick={() => openWindow(url)} className="cursor-pointer">
        <p>Read more on Pargraph →</p>
      </CardFooter>
    </Card>
  );

  const renderPublication = () => (
    <Card>
      <CardHeader>
        <CardTitle>{data.publication.name} on Paragraph</CardTitle>
        <CardDescription>
          <div className="flex justify-between space-x-3">
            <div className="flex flex-1 space-x-1 justify-between">
              <div className="flex-shrink-0 justify-center flex flex-col">
                <Avatar>
                  <AvatarImage src={data.user.avatar_url} />
                  <AvatarFallback>
                    {data.user.authorName || data.publication.name}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="ml-2 flex-1 min-w-0 flex flex-col justify-center -space-y-0.5">
                <div className="flex flex-row space-x-2">
                  {data.publication.name}
                </div>
                <div className="flex flex-row space-x-2">
                  posting since {" "}
                  {new Date(Number(data.publication.createdAt)).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="max-w-lg">{data.publication.summary}</p>
      </CardContent>
      <CardFooter onClick={() => openWindow(url)} className="cursor-pointer">
        <p>Read more on Pargraph</p>
      </CardFooter>
    </Card>
  );

  const renderData = () => {
    if (data.post) {
      return renderPost();
    } else if (data.publication) {
      return renderPublication();
    } else {
      return <p className="text-sm text-gray-300">{url}</p>;
    }
  };
  return <div key={`paragraph-xyz-embed-${url}`}>{renderData()}</div>;
};

export default ParagraphXyzEmbed;
