import { toast } from "sonner";
import truncate from "lodash.truncate";
import { openWindow } from "./navigation";

export const toastInfoReadOnlyMode = () => {
  toast.info("You're in read-only mode", {
    action: {
      label: "Signup to full account ↗",
      onClick: () =>
        openWindow(`${process.env.NEXT_PUBLIC_URL}/login?signupOnly=true`),
    },
    duration: 7500,
  });
};

export const toastSuccessCastPublished = (text: string) => {
  toast.success("Cast published successfully", {
    description: truncate(text, { length: 25 }),
  });
};

export const toastErrorCastPublish = (err?: string) => {
  toast.error("Error publishing cast :(", { description: err, duration: 5000 });
};

export const toastSuccessCastDeleted = (text: string) => {
  toast.success("Cast deleted successfully", {
    description: truncate(text, { length: 25 }),
  });
};

export const toastSuccessCastScheduled = (text: string) => {
  toast.success("Cast scheduled successfully", {
    description: truncate(text, { length: 25 }),
  });
};

export const toastSuccessSavedSearchUpdate = (name: string) => {
  toast.success(`Saved search "${name}" updated successfully`);
};

export const toastCopiedToClipboard = (text: string) => {
  toast.success("Copied to clipboard", {
    description: truncate(text, { length: 25 }),
  });
};

export const toastUnableToDeleteCast = () => {
  toast.error("Unable to delete cast", { duration: 5000 });
};

export const toastErrorUpgradeAccount = (reason?: string) => {
  toast.error("Error upgrading account", { description: reason, closeButton: true });
};
