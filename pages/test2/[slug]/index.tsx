import React from "react";
import { GetServerSideProps } from "next";

interface ProfileProps {
  slug: string;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  console.log("Test2 getServerSideProps", context);
  const { slug } = context.params!;
  return {
    props: {
      slug,
    },
  };
};

const Test2: React.FC<ProfileProps> = ({ slug }) => {
  return (
    <div className="bg-green-400">
      <h1>Profile Page 2</h1>
      <p>Slug: {slug}</p>
    </div>
  );
};

export default Test2;
