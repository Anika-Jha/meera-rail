import "dotenv/config";

import { privateKeyToAccount } from "viem/accounts";
import {
  x402Client,
  wrapFetchWithPayment,
} from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const SERVER_URL =
  process.env.MEERA_RAIL_URL ?? "http://localhost:4020";

const NETWORK = "eip155:84532";
const PRIVATE_KEY = process.env.BUYER_PRIVATE_KEY;

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error(
      "Missing BUYER_PRIVATE_KEY. This script is optional; the web UI uses a browser wallet instead.",
    );
  }

  if (!PRIVATE_KEY.startsWith("0x")) {
    throw new Error(
      "BUYER_PRIVATE_KEY must be a 0x-prefixed EVM private key.",
    );
  }

  const account = privateKeyToAccount(
    PRIVATE_KEY as `0x${string}`,
  );

  const client = new x402Client();

  client.register(
    NETWORK,
    new ExactEvmScheme(account),
  );

  const fetchWithPayment = wrapFetchWithPayment(
    fetch,
    client,
  );

  const notice =
    "Train 12951 at PUNE: Expected at 18:45. Delay due to heavy rain.";

  console.log("🚆 MeeraRail buyer");
  console.log(`👛 Payer: ${account.address}`);
  console.log(`🌐 Server: ${SERVER_URL}`);
  console.log(`⛓️ Network: ${NETWORK}`);
  console.log("💰 Maximum expected price: $0.001 USDC");
  console.log("");

  const response = await fetchWithPayment(
    `${SERVER_URL}/api/parse`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notice }),
    },
  );

  const result = await response.json();

  console.log(`HTTP ${response.status}`);
  console.log("");

  if (!response.ok) {
    console.error(" Request failed:");
    console.error(
      JSON.stringify(result, null, 2),
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    " Payment accepted and parse succeeded:",
  );

  console.log(
    JSON.stringify(result, null, 2),
  );
}

main().catch((error) => {
  console.error("Buyer failed:");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});