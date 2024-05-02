import { GET, POST } from "@frames.js/render/next";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const { method } = req;

    if (pathname === "/api/frames") {
        try {
            let response: Response;

            if (method === "GET") {
                response = await GET(req);
            } else if (method === "POST") {
                response = await POST(req);
            } else {
                return new NextResponse(JSON.stringify({ error: "Method Not Allowed" }), {
                    status: 405,
                    headers: { "Content-Type": "application/json" },
                });
            }

            if (response.status === 200) {
                const clonedResponse = response.clone();
                const data = await clonedResponse.json();
            } else {
                const clonedResponse = response.clone();
                const errorMessage = await clonedResponse.text();
            }

            return response;
        } catch (error) {
            return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    }

    return NextResponse.next();
}


export const config = {
    unstable_allowDynamic: [
        "/node_modules/@protobufjs/inquire/index.js",
    ],
};