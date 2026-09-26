import "dotenv/config";

const payTo = process.env.PAY_TO_ADDRESS;

if (!payTo) {
  throw new Error("Missing PAY_TO_ADDRESS environment variable");
}

export const SERVER_CONFIG = {
  port: Number(process.env.PORT ?? 4020),

  maxNoticeLength: 5000,
  maxBulkNotices: 50,

  payment: {
    // Base Sepolia only — deliberately hardcoded to testnet.
    network: "eip155:84532",

    facilitatorUrl:
      process.env.FACILITATOR_URL ?? "https://x402.org/facilitator",

    // Server-owned payment recipient.
    payTo,

    // Server-owned prices.
    prices: {
      single: "$0.001",
      bulk: "$0.003",
    },
  },
} as const;