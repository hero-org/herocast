import React from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";

interface ProfileProps {
  slug: string;
}

export const getStaticPaths: GetStaticPaths = async () => {
  console.log("Test getStaticPaths");
  return {
    paths: [],
    fallback: true,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  console.log("Test getStaticProps");
  const { slug } = context.params!;
  return {
    props: {
      slug,
    },
  };
};

const Test: React.FC<ProfileProps> = ({ slug }) => {
  const router = useRouter();

  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-green-400">
      <h1>Profile Page</h1>
      <p>Slug: {slug}</p>
    </div>
  );
};

export default Test;
