import { describe, expect, it } from "vitest";
import { resolveAdapter } from "../src/adapters";

describe("resolveAdapter", () => {
  it("resolves 104 adapter", () => {
    const adapter = resolveAdapter(new URL("https://www.104.com.tw/job/abc"));
    expect(adapter?.name).toBe("104");
  });

  it("resolves linkedin adapter", () => {
    const adapter = resolveAdapter(new URL("https://www.linkedin.com/jobs/view/123"));
    expect(adapter?.name).toBe("linkedin");
  });

  it("resolves seek adapter", () => {
    const adapter = resolveAdapter(new URL("https://www.seek.com.au/job/123"));
    expect(adapter?.name).toBe("seek");
  });

  it("returns undefined for unknown domain", () => {
    const adapter = resolveAdapter(new URL("https://example.com/jobs/123"));
    expect(adapter).toBeUndefined();
  });
});
