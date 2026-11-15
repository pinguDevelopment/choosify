import { de, type Messages } from "./de";
import { en } from "./en";
import type { Locale } from "./config";

export const MESSAGES: Record<Locale, Messages> = { de, en };
export type { Messages };
