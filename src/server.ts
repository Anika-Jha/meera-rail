import "dotenv/config";

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

import { paymentMiddleware } from "@x402/hono";
import {
  HTTPFacilitatorClient,
  x402ResourceServer,
} from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

import { SERVER_CONFIG } from "./config.js";
import { parseNotice, ParseError } from "./parser.js";

const app = new Hono();

/*
 * x402 PAYMENT SERVER
 */

const facilitatorClient = new HTTPFacilitatorClient({
  url: SERVER_CONFIG.payment.facilitatorUrl,
});

const resourceServer = new x402ResourceServer(facilitatorClient);

registerExactEvmScheme(resourceServer);

const paymentRoutes = {
  "POST /api/parse": {
    accepts: [
      {
        scheme: "exact",
        price: SERVER_CONFIG.payment.prices.single,
        network: SERVER_CONFIG.payment.network,
        payTo: SERVER_CONFIG.payment.payTo,
      },
    ],
    description: "Parse one railway delay notice",
    mimeType: "application/json",
  },

  "POST /api/parse/bulk": {
    accepts: [
      {
        scheme: "exact",
        price: SERVER_CONFIG.payment.prices.bulk,
        network: SERVER_CONFIG.payment.network,
        payTo: SERVER_CONFIG.payment.payTo,
      },
    ],
    description: "Parse multiple railway delay notices",
    mimeType: "application/json",
  },
};

/*
 * PAID ROUTES
 *
 * x402 runs before the route handler.
 */
app.use(
  "/api/parse",
  paymentMiddleware(paymentRoutes, resourceServer),
);

app.use(
  "/api/parse/bulk",
  paymentMiddleware(paymentRoutes, resourceServer),
);

/*
 * STATIC UI
 */

app.use(
  "/index.html",
  serveStatic({ root: "./public" }),
);

app.use(
  "/app.js",
  serveStatic({ root: "./public" }),
);

app.use(
  "/style.css",
  serveStatic({ root: "./public" }),
);

/*
 * FREE HOME PAGE
 */

app.get("/", (c) => {
  return c.redirect("/index.html");
});

/*
 * FREE HEALTH CHECK
 */

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "MeeraRail",
  });
});

/*
 * PAID SINGLE-PARSE ROUTE
 */

interface ParseRequestBody {
  notice?: unknown;
}

app.post("/api/parse", async (c) => {
  try {
    let body: ParseRequestBody;

    try {
      body = (await c.req.json()) as ParseRequestBody;
    } catch {
      return c.json(
        {
          error: "Request body must be valid JSON",
        },
        400,
      );
    }

    if (typeof body.notice !== "string") {
      return c.json(
        {
          error: "The 'notice' field must be a string",
        },
        400,
      );
    }

    if (body.notice.length > SERVER_CONFIG.maxNoticeLength) {
      return c.json(
        {
          error: "Notice is too large",
          maxLength: SERVER_CONFIG.maxNoticeLength,
        },
        413,
      );
    }

    const parsed = parseNotice(body.notice);

    return c.json(parsed, 200);
  } catch (error) {
    if (error instanceof ParseError) {
      return c.json(
        {
          error: "Unable to parse railway notice",
          message: error.message,
        },
        422,
      );
    }

    console.error("Unexpected /api/parse error:", error);

    return c.json(
      {
        error: "Internal server error",
      },
      500,
    );
  }
});

/*
 * PAID BULK-PARSE ROUTE
 */

interface BulkParseRequestBody {
  notices?: unknown;
}

app.post("/api/parse/bulk", async (c) => {
  try {
    let body: BulkParseRequestBody;

    try {
      body = (await c.req.json()) as BulkParseRequestBody;
    } catch {
      return c.json(
        {
          error: "Request body must be valid JSON",
        },
        400,
      );
    }

    if (!Array.isArray(body.notices)) {
      return c.json(
        {
          error: "The 'notices' field must be an array",
        },
        400,
      );
    }

    if (body.notices.length > SERVER_CONFIG.maxBulkNotices) {
      return c.json(
        {
          error: "Too many notices",
          maxNotices: SERVER_CONFIG.maxBulkNotices,
        },
        413,
      );
    }

    if (
      !body.notices.every(
        (notice: unknown): notice is string =>
          typeof notice === "string",
      )
    ) {
      return c.json(
        {
          error: "Every notice must be a string",
        },
        400,
      );
    }

    const oversizedIndex = body.notices.findIndex(
      (notice) =>
        notice.length > SERVER_CONFIG.maxNoticeLength,
    );

    if (oversizedIndex !== -1) {
      return c.json(
        {
          error: "One or more notices are too large",
          maxLength: SERVER_CONFIG.maxNoticeLength,
          index: oversizedIndex,
        },
        413,
      );
    }

    const results = [];

    for (let index = 0; index < body.notices.length; index++) {
      try {
        const parsed = parseNotice(body.notices[index]);

        results.push(parsed);
      } catch (error) {
        if (error instanceof ParseError) {
          return c.json(
            {
              error: "Unable to parse one or more railway notices",
              index,
              message: error.message,
            },
            422,
          );
        }

        throw error;
      }
    }

    return c.json(
      {
        count: results.length,
        results,
      },
      200,
    );
  } catch (error) {
    if (error instanceof ParseError) {
      return c.json(
        {
          error: "Unable to parse one or more railway notices",
          message: error.message,
        },
        422,
      );
    }

    console.error(
      "Unexpected /api/parse/bulk error:",
      error,
    );

    return c.json(
      {
        error: "Internal server error",
      },
      500,
    );
  }
});

/*
 * SERVER STARTUP
 */

console.log(
  `🚆 MeeraRail running on http://localhost:${SERVER_CONFIG.port}`,
);

console.log(
  `💳 x402 network: ${SERVER_CONFIG.payment.network}`,
);

console.log(
  `💰 Single parse: ${SERVER_CONFIG.payment.prices.single}`,
);

console.log(
  `📦 Bulk parse: ${SERVER_CONFIG.payment.prices.bulk}`,
);

serve({
  fetch: app.fetch,
  port: SERVER_CONFIG.port,
});