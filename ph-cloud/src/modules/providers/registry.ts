import "server-only";
import { env } from "@/config/env";
import { ADAPTERS, getAdapter } from "./adapters";
import type { ProviderAdapter, ProviderState } from "./types";

export function isProviderEnabled(id: string): boolean {
  const e = env();
  switch (id) {
    case "phcloud":
    case "external":
    case "cloud":
      return true;
    case "itchio":
      return e.PROVIDER_ITCHIO_ENABLED;
    case "gamedistribution":
      return e.PROVIDER_GAMEDISTRIBUTION_ENABLED;
    default:
      return false;
  }
}

export function providerState(a: ProviderAdapter): ProviderState {
  return isProviderEnabled(a.id) ? "active" : "disabled";
}

export function enabledAdapters(): ProviderAdapter[] {
  return ADAPTERS.filter((a) => isProviderEnabled(a.id));
}

export function enabledFrameOrigins(): string[] {
  return enabledAdapters().flatMap((a) => a.frameOrigins);
}

export function enabledImageOrigins(): string[] {
  return enabledAdapters().flatMap((a) => a.imageOrigins);
}

export { ADAPTERS, getAdapter };
