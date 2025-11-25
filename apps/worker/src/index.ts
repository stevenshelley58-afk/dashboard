import path from "path";
import http from "http";
import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath, override: true });

import { verifyDatabaseConnection } from "./db.js";
import { startJobDispatcher } from "./job-dispatcher.js";

const HEALTH_PORT = Number(process.env.PORT) || 3000;
let isDbHealthy = false;
const startTime = Date.now();

function startHealthServer(): void {
  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/health") {
      const status = isDbHealthy ? 200 : 503;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: isDbHealthy ? "healthy" : "starting",
          db: isDbHealthy ? "connected" : "connecting",
          uptime: Math.floor((Date.now() - startTime) / 1000),
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  server.listen(HEALTH_PORT, () => {
    console.log(`Health server listening on port ${HEALTH_PORT}`);
  });
}

async function main(): Promise<void> {
  // Start health server immediately so Railway can see we're alive
  startHealthServer();

  try {
    const timestamp = await verifyDatabaseConnection();
    isDbHealthy = true;
    console.log(`DB connection ok @ ${timestamp.toISOString()}`);
    await startJobDispatcher();
  } catch (error) {
    console.error("Failed to verify database connectivity", error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Unhandled error during worker startup", error);
  process.exitCode = 1;
});

