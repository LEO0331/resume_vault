import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.fn();

vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
}));

beforeEach(() => {
  lookupMock.mockReset();
});

describe("network-safety", () => {
  it("detects private IPv4 and IPv6 ranges", async () => {
    const { isPrivateIp } = await import("../src/network-safety");

    expect(isPrivateIp("10.1.2.3")).toBe(true);
    expect(isPrivateIp("192.168.1.5")).toBe(true);
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
    expect(isPrivateIp("not-an-ip")).toBe(false);
  });

  it("rejects non-http protocols", async () => {
    const { assertSafeTargetUrl } = await import("../src/network-safety");
    await expect(assertSafeTargetUrl("file:///etc/passwd")).rejects.toThrow("Only http/https URLs are supported.");
  });

  it("rejects localhost and private IP literals", async () => {
    const { assertSafeTargetUrl } = await import("../src/network-safety");

    await expect(assertSafeTargetUrl("http://localhost:3000")).rejects.toThrow("Blocked localhost/private-network target");
    await expect(assertSafeTargetUrl("http://127.0.0.1:3000")).rejects.toThrow("Blocked localhost/private-network target");
  });

  it("blocks hostnames resolving to private addresses", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);

    const { assertSafeTargetUrl } = await import("../src/network-safety");
    await expect(assertSafeTargetUrl("https://internal.example")).rejects.toThrow("Blocked localhost/private-network target");
  });

  it("allows hostnames resolving to public addresses", async () => {
    lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);

    const { assertSafeTargetUrl } = await import("../src/network-safety");
    await expect(assertSafeTargetUrl("https://www.example.com")).resolves.toBeUndefined();
  });

  it("treats DNS failures as blocked", async () => {
    lookupMock.mockRejectedValue(new Error("dns fail"));

    const { shouldBlockRequestUrl } = await import("../src/network-safety");
    await expect(shouldBlockRequestUrl("https://unknown.example")).resolves.toBe(true);
  });

  it("blocks empty hostname values and allows public ip literal", async () => {
    const { isPrivateHost } = await import("../src/network-safety");

    await expect(isPrivateHost("   ")).resolves.toBe(true);
    await expect(isPrivateHost("8.8.8.8")).resolves.toBe(false);
  });

  it("uses cached hostname decision on repeated lookups", async () => {
    lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);

    const { isPrivateHost } = await import("../src/network-safety");
    await expect(isPrivateHost("cache-test.example")).resolves.toBe(false);
    await expect(isPrivateHost("cache-test.example")).resolves.toBe(false);
    expect(lookupMock).toHaveBeenCalledTimes(1);
  });

  it("allows non-http request URLs in request filter", async () => {
    const { shouldBlockRequestUrl } = await import("../src/network-safety");
    await expect(shouldBlockRequestUrl("data:text/plain,hello")).resolves.toBe(false);
  });

  it("returns false for invalid request URLs in request filter", async () => {
    const { shouldBlockRequestUrl } = await import("../src/network-safety");
    await expect(shouldBlockRequestUrl("not-a-url")).resolves.toBe(false);
  });
});
