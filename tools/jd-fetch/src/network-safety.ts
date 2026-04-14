import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const isPrivateIpv4 = (ip: string): boolean => {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254)
  );
};

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
};

export const isPrivateIp = (ip: string): boolean => {
  const family = isIP(ip);
  if (family === 4) {
    return isPrivateIpv4(ip);
  }
  if (family === 6) {
    return isPrivateIpv6(ip);
  }
  return false;
};

const HOST_CACHE = new Map<string, boolean>();

export const isPrivateHost = async (hostname: string): Promise<boolean> => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }

  if (isIP(normalized) > 0) {
    return isPrivateIp(normalized);
  }

  if (HOST_CACHE.has(normalized)) {
    return HOST_CACHE.get(normalized) ?? true;
  }

  try {
    const resolved = await lookup(normalized, { all: true });
    const blocked = resolved.some((entry) => isPrivateIp(entry.address));
    HOST_CACHE.set(normalized, blocked);
    return blocked;
  } catch {
    // Conservative default for unresolved names in security checks.
    HOST_CACHE.set(normalized, true);
    return true;
  }
};

export const assertSafeTargetUrl = async (rawUrl: string): Promise<void> => {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http/https URLs are supported.");
  }

  if (await isPrivateHost(url.hostname)) {
    throw new Error("Blocked localhost/private-network target. Use --allow-private-network to override.");
  }
};

export const shouldBlockRequestUrl = async (rawUrl: string): Promise<boolean> => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return false;
  }

  return isPrivateHost(parsed.hostname);
};
