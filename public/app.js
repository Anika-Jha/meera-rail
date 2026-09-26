const noticeInput = document.getElementById("notice");
const characterCount = document.getElementById("character-count");
const parseButton = document.getElementById("parse-button");
const walletStatus = document.getElementById("wallet-status");
const result = document.getElementById("result");

const BASE_SEPOLIA_CHAIN_ID = "0x14a34";

noticeInput.addEventListener("input", () => {
  characterCount.textContent =
    `${noticeInput.value.length} / 5000`;
});

function showResult(html, type = "") {
  result.className = `result card ${type}`;
  result.innerHTML = html;

  result.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

function setLoading(isLoading, text = "") {
  parseButton.disabled = isLoading;

  if (isLoading) {
    parseButton.textContent = text;
  } else {
    parseButton.textContent =
      "Connect Wallet & Parse — $0.001";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getEthereumProvider() {
  if (!window.ethereum) {
    throw new Error(
      "No compatible wallet found. Please install MetaMask or another EVM wallet.",
    );
  }

  return window.ethereum;
}

async function connectWallet() {
  const ethereum = getEthereumProvider();

  const accounts = await ethereum.request({
    method: "eth_requestAccounts",
  });

  if (!accounts || accounts.length === 0) {
    throw new Error("No wallet account was selected.");
  }

  return accounts[0];
}

async function switchToBaseSepolia() {
  const ethereum = getEthereumProvider();

  const currentChain = await ethereum.request({
    method: "eth_chainId",
  });

  if (currentChain === BASE_SEPOLIA_CHAIN_ID) {
    return;
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: BASE_SEPOLIA_CHAIN_ID,
        },
      ],
    });
  } catch (error) {
    if (error?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BASE_SEPOLIA_CHAIN_ID,
            chainName: "Base Sepolia",
            nativeCurrency: {
              name: "Ether",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: [
              "https://sepolia.base.org",
            ],
            blockExplorerUrls: [
              "https://sepolia.basescan.org",
            ],
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

function encodeBase64Json(value) {
  const json = JSON.stringify(value);

  const bytes = new TextEncoder().encode(json);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function decodeBase64Json(value) {
  const binary = atob(value);

  const bytes = Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );

  return JSON.parse(
    new TextDecoder().decode(bytes),
  );
}

function randomHex(bytesLength = 32) {
  const bytes = new Uint8Array(bytesLength);

  crypto.getRandomValues(bytes);

  return (
    "0x" +
    Array.from(bytes)
      .map((byte) =>
        byte.toString(16).padStart(2, "0"),
      )
      .join("")
  );
}

async function getPaymentRequirements(notice) {
  const response = await fetch("/api/parse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notice,
    }),
  });

  if (response.status !== 402) {
    return {
      response,
      paymentRequired: null,
    };
  }

  const header =
    response.headers.get("PAYMENT-REQUIRED");

  if (!header) {
    throw new Error(
      "Server returned 402 but did not provide payment requirements.",
    );
  }

  const paymentRequired =
    decodeBase64Json(header);

  return {
    response,
    paymentRequired,
  };
}

async function createPaymentSignature(
  paymentRequired,
  account,
) {
  if (
    !paymentRequired ||
    !Array.isArray(paymentRequired.accepts) ||
    paymentRequired.accepts.length === 0
  ) {
    throw new Error(
      "Server did not provide a valid payment option.",
    );
  }

  const requirement =
    paymentRequired.accepts.find(
      (item) =>
        item.scheme === "exact" &&
        item.network === "eip155:84532",
    );

  if (!requirement) {
    throw new Error(
      "MeeraRail did not advertise Base Sepolia payment support.",
    );
  }

  const chainId = 84532;

  const now = Math.floor(Date.now() / 1000);

  const validAfter = now - 60;

  const validBefore =
    now +
    Number(
      requirement.maxTimeoutSeconds ?? 300,
    );

  const authorization = {
    from: account,
    to: requirement.payTo,
    value: requirement.amount,
    validAfter: String(validAfter),
    validBefore: String(validBefore),
    nonce: randomHex(32),
  };

  const typedData = {
    domain: {
      name: requirement.extra?.name ?? "USDC",
      version: requirement.extra?.version ?? "2",
      chainId,
      verifyingContract: requirement.asset,
    },

    types: {
      TransferWithAuthorization: [
        {
          name: "from",
          type: "address",
        },
        {
          name: "to",
          type: "address",
        },
        {
          name: "value",
          type: "uint256",
        },
        {
          name: "validAfter",
          type: "uint256",
        },
        {
          name: "validBefore",
          type: "uint256",
        },
        {
          name: "nonce",
          type: "bytes32",
        },
      ],
    },

    primaryType:
      "TransferWithAuthorization",

    message: authorization,
  };

  const ethereum = getEthereumProvider();

  const signature =
    await ethereum.request({
      method: "eth_signTypedData_v4",
      params: [
        account,
        JSON.stringify(typedData),
      ],
    });

  const paymentPayload = {
    x402Version: 2,

    resource: paymentRequired.resource,

    accepted: requirement,

    payload: {
      signature,
      authorization,
    },

    extensions:
      paymentRequired.extensions ?? {},
  };

  return encodeBase64Json(paymentPayload);
}

async function parseWithPayment(
  notice,
  paymentSignature,
) {
  return fetch("/api/parse", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",

      "PAYMENT-SIGNATURE":
        paymentSignature,
    },

    body: JSON.stringify({
      notice,
    }),
  });
}

parseButton.addEventListener(
  "click",
  async () => {
    const notice =
      noticeInput.value.trim();

    if (!notice) {
      showResult(
        `
          <h3 class="result-title">
            ✕ Nothing to parse
          </h3>

          <p class="error-message">
            Paste a railway delay notice first.
          </p>
        `,
        "result-error",
      );

      return;
    }

    try {
      setLoading(
        true,
        "Connecting wallet…",
      );

      walletStatus.textContent =
        "Connect your testnet wallet…";

      const account =
        await connectWallet();

      setLoading(
        true,
        "Switching network…",
      );

      walletStatus.textContent =
        "Checking Base Sepolia…";

      await switchToBaseSepolia();

      setLoading(
        true,
        "Checking payment…",
      );

      walletStatus.textContent =
        "Preparing the $0.001 USDC payment…";

      const {
        response,
        paymentRequired,
      } =
        await getPaymentRequirements(
          notice,
        );

      if (response.status !== 402) {
        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
            data.error ||
            "Request failed.",
          );
        }

        showParsedResult(data);

        return;
      }

      setLoading(
        true,
        "Approve payment…",
      );

      walletStatus.textContent =
        "Your wallet will ask you to approve a $0.001 USDC signature.";

      const paymentSignature =
        await createPaymentSignature(
          paymentRequired,
          account,
        );

      setLoading(
        true,
        "Parsing notice…",
      );

      walletStatus.textContent =
        "Payment authorization signed. Sending notice…";

      const paidResponse =
        await parseWithPayment(
          notice,
          paymentSignature,
        );

      const data =
        await paidResponse.json();

      if (!paidResponse.ok) {
        showResult(
          `
            <h3 class="result-title">
              ✕ We couldn't read this notice
            </h3>

            <p class="error-message">
              ${escapeHtml(
                data.message ||
                data.error ||
                "The notice could not be parsed.",
              )}
            </p>

            <p>
              The parser rejected the notice.
              No successful result was produced.
            </p>
          `,
          "result-error",
        );

        return;
      }

      showParsedResult(data);

      walletStatus.textContent =
        "Payment accepted • Notice parsed successfully";
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      if (
        message.toLowerCase().includes("user rejected") ||
        message.toLowerCase().includes("user denied")
      ) {
        showResult(
          `
            <h3 class="result-title">
              Payment cancelled
            </h3>

            <p>
              Your wallet was not charged because
              you cancelled the request.
            </p>
          `,
          "result-error",
        );
      } else {
        showResult(
          `
            <h3 class="result-title">
              ✕ Request failed
            </h3>

            <p class="error-message">
              ${escapeHtml(message)}
            </p>
          `,
          "result-error",
        );
      }

      walletStatus.textContent =
        "No payment completed.";
    } finally {
      setLoading(false);
    }
  },
);

function showParsedResult(data) {
  showResult(
    `
      <h3 class="result-title">
        ✓ Notice parsed
      </h3>

      <div class="result-grid">
        <div class="result-item">
          <span class="result-label">
            Train
          </span>

          <span class="result-value">
            ${escapeHtml(data.train)}
          </span>
        </div>

        <div class="result-item">
          <span class="result-label">
            Station
          </span>

          <span class="result-value">
            ${escapeHtml(data.station)}
          </span>
        </div>

        <div class="result-item">
          <span class="result-label">
            Expected time
          </span>

          <span class="result-value">
            ${escapeHtml(data.expectedTime)}
          </span>
        </div>

        <div class="result-item">
          <span class="result-label">
            Reason
          </span>

          <span class="result-value">
            ${escapeHtml(
              data.reason || "Not provided",
            )}
          </span>
        </div>
      </div>

      <p class="payment-note">
        ✓ Parsed successfully
      </p>
    `,
    "result-success",
  );
}