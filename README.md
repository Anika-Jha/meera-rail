#  MeeraRail

### Paste a railway delay notice. Get clean data. Pay only when it works.

MeeraRail is a pay-per-call railway delay parsing API inspired by **The Operator's Booth: Meera's Railway Delay API**.

It takes messy, human-written railway delay notices and turns them into predictable JSON that commuter applications and other software can consume.

The core idea is simple:

> **If MeeraRail cannot read the notice, the request fails instead of returning fake or incomplete data.**

Payments use **x402 on Base Sepolia with test USDC**. There are no accounts, API keys, subscriptions, or invoices.

---

## What does MeeraRail do?

A railway notice might look like:

```text
Train 12951 at PUNE: Expected at 18:45. Delay due to heavy rain.
```

MeeraRail turns it into:

```json
{
  "train": "12951",
  "station": "PUNE",
  "expectedTime": "18:45",
  "reason": "heavy rain"
}
```

This gives applications structured information instead of forcing every application to understand free-form railway notices itself.

---

## How it works

```text
Railway delay notice
        │
        ▼
   MeeraRail API
        │
        ├── readable ──────► structured JSON
        │
        └── unreadable ────► 422 error
```

For a paid request:

```text
Buyer
  │
  │ POST /api/parse
  ▼
MeeraRail
  │
  │ 402 Payment Required
  ▼
Buyer wallet
  │
  │ signs test USDC payment
  ▼
MeeraRail
  │
  ├── parse succeeds ──► JSON result
  │
  └── parse fails ─────► 422 error
```

Payments are handled through the **x402 protocol**.

---

#  Features

*  Railway delay notice parser
*  x402 pay-per-call payments
*  Base Sepolia testnet only
*  Test USDC
*  Browser-wallet payment flow
*  Human-friendly web interface
*  HTTP API for developers
*  Single and bulk parsing
*  Server-controlled prices
*  Server-controlled payment recipient
*  Input-size limits
*  Zod schema validation
*  Malformed notices are rejected
*  No private keys stored in the repository
*  Automated parser and configuration tests

---

#  Pricing

| Endpoint               |        Price | Description                       |
| ---------------------- | -----------: | --------------------------------- |
| `POST /api/parse`      |     `$0.001` | Parse one notice                  |
| `POST /api/parse/bulk` |     `$0.003` | Parse up to 50 notices            |
| `GET /health`          |         Free | Health check                      |
| Web interface          | Free to open | Payment only happens when parsing |

Prices are controlled by the server and are **not accepted from the caller**.

The payment recipient is also controlled by the server.

---

#  Testnet

MeeraRail currently uses:

```text
Network: Base Sepolia
CAIP-2:  eip155:84532
Asset:   USDC
Mode:    Testnet
```

No real funds are required for the demo.

The Base Sepolia USDC contract is:

```text
0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

---

#  Try the web interface

Start the server:

```bash
npm run dev
```

Then open:

```text
http://localhost:4020
```

The interface explains the product and provides a live parser.

### Browser payment flow

The web UI:

1. Connects to the user's browser wallet.
2. Switches to Base Sepolia.
3. Sends the parsing request.
4. Receives the x402 payment requirement.
5. Asks the wallet to authorize the test USDC payment.
6. Sends the payment authorization back to MeeraRail.
7. Receives the parsed railway data.

The browser wallet signs the payment.

**No private key is stored in the application.**

---

#  API

## Free health check

```http
GET /health
```

Example:

```bash
curl http://localhost:4020/health
```

Response:

```json
{
  "status": "ok",
  "service": "MeeraRail"
}
```

---

## Single parse

```http
POST /api/parse
```

Price:

```text
$0.001 USDC
```

Request:

```json
{
  "notice": "Train 12951 at PUNE: Expected at 18:45. Delay due to heavy rain."
}
```

A request without a valid x402 payment receives:

```text
402 Payment Required
```

After successful payment and parsing:

```json
{
  "train": "12951",
  "station": "PUNE",
  "expectedTime": "18:45",
  "reason": "heavy rain"
}
```

---

#  Bulk parse

```http
POST /api/parse/bulk
```

Price:

```text
$0.003 USDC
```

Request:

```json
{
  "notices": [
    "Train 12951 at PUNE: Expected at 18:45. Delay due to heavy rain.",
    "Train 12124 at MUMBAI: Expected at 19:30."
  ]
}
```

Response:

```json
{
  "count": 2,
  "results": [
    {
      "train": "12951",
      "station": "PUNE",
      "expectedTime": "18:45",
      "reason": "heavy rain"
    },
    {
      "train": "12124",
      "station": "MUMBAI",
      "expectedTime": "19:30",
      "reason": null
    }
  ]
}
```

Bulk requests are limited to **50 notices**.

Each individual notice is limited to **5,000 characters**.

---

#  What happens when parsing fails?

MeeraRail deliberately does not guess.

For example:

```text
asdf qwerty this is not a railway notice
```

results in:

```http
422 Unprocessable Entity
```

with an error such as:

```json
{
  "error": "Unable to parse railway notice",
  "message": "Could not identify the train number"
}
```

The parser requires the important fields needed to produce its declared output:

* Train number
* Station code
* Expected time

The delay reason is optional.

---

#  Output schema

Every successful result is validated against the following schema:

```json
{
  "train": "string",
  "station": "string",
  "expectedTime": "HH:MM",
  "reason": "string | null"
}
```

The application uses Zod validation before returning parser output.

This prevents malformed internal parser results from being returned as successful API responses.

---

#  Input protection

MeeraRail applies server-side limits rather than relying only on the frontend.

### Single notices

Maximum:

```text
5,000 characters
```

### Bulk requests

Maximum:

```text
50 notices
```

### Invalid input

Invalid JSON, missing fields, incorrect types, oversized input, and unparseable notices are rejected by the server.

---

#  x402 payment architecture

The paid routes are protected by x402 middleware.

```text
Client
  │
  │ POST /api/parse
  ▼
x402 middleware
  │
  ├── no payment ───────► 402 Payment Required
  │
  └── valid payment ────► parser
                              │
                              ▼
                         structured JSON
```

Payment configuration is controlled by the server:

```text
Network: eip155:84532
Single:  $0.001
Bulk:    $0.003
payTo:   server-owned wallet
```

The caller cannot choose:

* the price
* the payment recipient
* the network

---

# 🧑‍💻 CLI buyer

The repository also contains an automated x402 buyer example:

```text
buyer/buy.ts
```

It uses:

* `@x402/fetch`
* `@x402/evm`
* `viem`

The client automatically handles the x402 payment challenge and retry flow.

### Important

The CLI buyer is an optional developer example.

The main web application does **not** require a private key.

If you want to run the CLI buyer, provide a testnet-only private key through your local environment:

```env
BUYER_PRIVATE_KEY=0x...
MEERA_RAIL_URL=http://localhost:4020
```

Then:

```bash
npm run buyer
```

**Never commit this private key.**

The repository's `.gitignore` excludes `.env`.

The recommended user-facing payment flow is the browser wallet.

---

# ⚙️ Installation

Clone the repository and install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Configure:

```env
PORT=4020

PAY_TO_ADDRESS=0xYOUR_TESTNET_WALLET_ADDRESS

FACILITATOR_URL=https://x402.org/facilitator
```

`PAY_TO_ADDRESS` must be an EVM address that receives the testnet payment.

Do not commit `.env`.

---

# ▶️ Run locally

Development mode:

```bash
npm run dev
```

Or:

```bash
npm start
```

The application runs at:

```text
http://localhost:4020
```

---

#  Run tests

Run the complete test suite:

```bash
npm test
```

Build the TypeScript project:

```bash
npm run build
```

The tests cover parser behavior and important server configuration such as:

* Base Sepolia network
* Server-controlled prices
* Server-controlled payment recipient
* Input size limits
* Facilitator configuration
* Malformed notices
* Missing parser fields
* Oversized notices

---

#  Project structure

```text
meera-rail/
│
├── src/
│   ├── server.ts       # Hono API + x402 middleware
│   ├── parser.ts       # Railway notice parser
│   ├── schema.ts       # Zod output schema
│   └── config.ts       # Server configuration
│
├── buyer/
│   └── buy.ts          # Automated x402 buyer example
│
├── public/
│   ├── index.html      # Web interface
│   ├── app.js          # Browser wallet + payment flow
│   └── style.css       # UI styling
│
├── tests/
│   ├── parser.test.ts  # Parser tests
│   └── server.test.ts  # Server/config tests
│
├── samples/
│   ├── valid/          # Valid notice examples
│   └── malformed/      # Deliberately broken examples
│
├── .env.example        # Safe environment template
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

---

#  Security and secrets

Secrets are intentionally kept outside the repository.

The following are ignored by Git:

```text
.env
dist/
node_modules/
```

The repository contains:

```text
.env.example
```

but does not contain real credentials.

Never commit:

```text
BUYER_PRIVATE_KEY
```

or any other private key, seed phrase, API secret, or wallet credential.

For the web interface, wallet signing happens through the user's browser wallet.

---

#  Challenge mapping

MeeraRail directly addresses the requirements of **The Operator's Booth: Meera's Railway Delay API**.

| Requirement              | Implementation                          |
| ------------------------ | --------------------------------------- |
| HTTP API                 | Hono API                                |
| Raw railway notice input | `POST /api/parse`                       |
| Structured JSON          | Zod-validated parser output             |
| Free route               | `/health`                               |
| Paid route               | `/api/parse`                            |
| Second paid route        | `/api/parse/bulk`                       |
| Different prices         | `$0.001` / `$0.003`                     |
| x402                     | `@x402/hono`                            |
| Testnet                  | Base Sepolia                            |
| Test USDC                | Base Sepolia USDC                       |
| Buyer                    | `buyer/buy.ts`                          |
| Browser payment          | Browser wallet + x402 payment signature |
| Secrets out of repo      | `.env` ignored                          |
| Server-side pricing      | `src/config.ts`                         |
| Server-side `payTo`      | `src/config.ts`                         |
| Malformed notices        | `422`                                   |
| Input limits             | Server-side limits                      |
| Schema validation        | Zod                                     |
| Automated malformed test | `tests/parser.test.ts`                  |

---

#  Design principle

MeeraRail is intentionally built around one rule:

> **Don't charge for data you couldn't produce.**

The parser is therefore designed to fail explicitly instead of inventing missing information.

This makes the API useful to applications that need predictable machine-readable railway data from messy human-written notices.

---

#  The idea

Meera is a retired railway clerk in Pune.

She knows how railway delay notices actually look: inconsistent, abbreviated, multilingual, and often written for humans rather than software.

MeeraRail turns that operational knowledge into a small machine-readable service:

```text
Messy railway notice
        ↓
     MeeraRail
        ↓
Clean structured data
        ↓
Apps / commuters / automation
```

And with x402:

```text
Use the parser
      ↓
Pay per successful call
      ↓
No account
No API key
No subscription
No invoice
```

---

## Built for The Operator's Booth

**MeeraRail**

*Paste a railway delay notice. Get clean data. Pay only when it works.*

**Base Sepolia • Test USDC • x402**
