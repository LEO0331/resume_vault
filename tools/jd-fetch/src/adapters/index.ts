import type { JobAdapter } from "./types.js";
import { adapter104 } from "./a104.js";
import { linkedinAdapter } from "./linkedin.js";
import { seekAdapter } from "./seek.js";

const adapters: JobAdapter[] = [adapter104, linkedinAdapter, seekAdapter];

export const resolveAdapter = (url: URL): JobAdapter | undefined => {
  return adapters.find((adapter) => adapter.supports(url));
};
