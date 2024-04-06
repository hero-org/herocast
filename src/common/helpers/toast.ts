import { toast } from "sonner";
import truncate from "lodash.truncate";

export const toastInfoReadOnlyMode = () => {
    toast.info('You\'re using a readonly account', {
        description: '<a href="/login">Switch to a full account to start casting ↗️</a>',
        descriptionClassName: "underline",
        duration: 7000
    })
}

export const toastSuccessCastPublished = (text: string) => {
    toast.success('Cast published successfully', { description: truncate(text, { length: 25 }) });
}