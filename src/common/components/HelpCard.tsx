import React from 'react';
import { PaperAirplaneIcon } from "@heroicons/react/20/solid";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import { openWindow } from "@/common/helpers/navigation";
import { Button } from '@/components/ui/button';

const HelpCard = () => (
    <Card className="mt-12">
        <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Need help?</CardTitle>
            <CardDescription>
                Did anythin break? Need support? Want to chat about Farcaster apps?
            </CardDescription>
        </CardHeader>
        <CardContent className="grid">
            <div className="grid grid-cols-2 gap-6">
                <Button variant="default" onClick={() => openWindow('https://warpcast.com/hellno')}>
                    <ChatBubbleLeftEllipsisIcon className="mr-2 h-4 w-4" />
                    Talk to me on Warpcast
                </Button>
                <Button variant="link" onClick={() => openWindow('https://t.me/HELLNO_HELLNO')}>
                    <PaperAirplaneIcon className="mr-2 h-4 w-4" />
                    Talk to me on Telegram
                </Button>
            </div>
        </CardContent>
    </Card>
);

export default HelpCard;
