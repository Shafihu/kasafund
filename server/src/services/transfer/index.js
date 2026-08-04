import { env } from "../../config/env.js";
import { liveTransferService } from "./liveTransferService.js";
import { mockTransferService } from "./mockTransferService.js";

export const transferService = env.paystackLiveTransfers
  ? liveTransferService
  : mockTransferService;

export const transferMode = transferService.mode;
