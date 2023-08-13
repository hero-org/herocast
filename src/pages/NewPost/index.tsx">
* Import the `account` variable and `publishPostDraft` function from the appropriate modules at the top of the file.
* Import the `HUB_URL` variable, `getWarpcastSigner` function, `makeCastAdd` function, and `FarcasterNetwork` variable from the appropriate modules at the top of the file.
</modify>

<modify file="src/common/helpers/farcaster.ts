import { classNames } from "@/common/helpers/css";
import { useAccountStore } from "@/stores/useAccountStore";
import { PostType, useNewPostStore } from "@/stores/useNewPostStore";
import { CheckCircleIcon } from "@chakra-ui/icons";
import { useToast } from "@chakra-ui/react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import React from "react";
import { HUB_URL, FarcasterNetwork } from "@/common/constants/farcaster";
import { getWarpcastSigner, makeCastAdd } from "@/common/helpers/farcaster";
import grpc from "grpc";

// Rest of th

