/* eslint-disable react/jsx-key */
/* eslint-disable react/no-unknown-property */

import React from "react";
import { createFrames, Button } from "frames.js/next/pages-router/server";
import { createClient } from "@/common/helpers/supabase/static-props";

const frames = createFrames({
  basePath: "/api/frames/analytics",
});

const handleRequest = frames(async (ctx) => {
  console.log("/api/frames/analytics handleRequest", ctx.searchParams);
  const { searchParams } = ctx;
  const { username, fid } = searchParams;
  const supabaseClient = createClient();
  const { data: analyticsRow, error } = await supabaseClient
    .from("analytics")
    .select("*")
    .eq("fid", fid)
    .maybeSingle();
  console.log("analyticsRow", analyticsRow, error);

  return {
    image: (
      <div tw="bg-purple-800 text-white w-full h-full justify-center items-center flex text-[48px]">
        The current time is {new Date().toLocaleString()}
      </div>
    ),
    buttons: [
      <Button action="post">Click me</Button>,
      <Button action="link" target="https://app.herocast.xyz/analytics">
        Next frame
      </Button>,
    ],
  };
});

export default handleRequest;
