import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(
    "SIWE API",
    req.query,
    req.method,
    req.headers,
    req.cookies,
    req.body
  );

  res.redirect("/");
}
