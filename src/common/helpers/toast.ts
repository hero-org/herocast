import { toast } from "sonner";
import truncate from "lodash.truncate";

export const toastInfoReadOnlyMode = () => {
    toast.info('You\'re using a readonly account', {
        description: '<a href="/login?signupOnly=true">Switch to a full account to start casting ↗️</a>',
        descriptionClassName: "underline",
        duration: 7500
    })
}

export const toastSuccessCastPublished = (text: string) => {
    toast.success('Cast published successfully', { description: truncate(text, { length: 25 }) });
}

export const toastErrorCastPublish = (err?: string) => {
    toast.error('Error publishing cast :(', { description: err, duration: 5000 });
}

export const toastSuccessCastScheduled = (text: string) => {
    toast.success('Cast scheduled successfully', { description: truncate(text, { length: 25 }) });
}