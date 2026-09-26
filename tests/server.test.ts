import { describe, expect, it } from "vitest";
import { SERVER_CONFIG } from "../src/config.js";

describe("MeeraRail server configuration", () => {
  it("uses Base Sepolia only", () => {
    expect(SERVER_CONFIG.payment.network).toBe("eip155:84532");
  });

  it("does not use Base mainnet", () => {
    expect(SERVER_CONFIG.payment.network).not.toBe("eip155:8453");
  });

  it("has a server-controlled single-parse price", () => {
    expect(SERVER_CONFIG.payment.prices.single).toBe("$0.001");
  });

  it("has a server-controlled bulk-parse price", () => {
    expect(SERVER_CONFIG.payment.prices.bulk).toBe("$0.003");
  });

  it("has a server-controlled payTo address", () => {
    expect(SERVER_CONFIG.payment.payTo).toMatch(
      /^0x[a-fA-F0-9]{40}$/,
    );
  });

  it("has a server-side notice size limit", () => {
    expect(SERVER_CONFIG.maxNoticeLength).toBe(5000);
  });

  it("has a server-side bulk notice limit", () => {
    expect(SERVER_CONFIG.maxBulkNotices).toBe(50);
  });

  it("uses the x402 facilitator", () => {
    expect(SERVER_CONFIG.payment.facilitatorUrl).toBe(
      "https://x402.org/facilitator",
    );
  });
});