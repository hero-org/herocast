import { RUNNING_IN_TAURI } from "@/common/constants/tauri";
import { useLocalForage } from "@/common/hooks/useLocalForage";
import { useTauriStore } from "@/common/hooks/useTauriStore";

export const useStorage = RUNNING_IN_TAURI ? useTauriStore : useLocalForage;
