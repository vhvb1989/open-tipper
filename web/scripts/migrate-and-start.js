/**
 * Azure startup script: runs Prisma migrations with managed identity,
 * then starts the Next.js production server.
 *
 * In Azure, Prisma CLI needs a DATABASE_URL with a password. Since we use
 * managed identity, we acquire an Azure AD token and inject it as the password
 * before running `prisma migrate deploy`.
 *
 * Locally, this script is not used — `npm run start` is sufficient.
 */

const { execSync } = require("child_process");
const https = require("https");

/**
 * Acquire an Azure AD access token using the App Service managed identity
 * via the local IDENTITY_ENDPOINT (no SDK needed).
 */
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const endpoint = process.env.IDENTITY_ENDPOINT;
    const header = process.env.IDENTITY_HEADER;

    if (!endpoint || !header) {
      return reject(new Error("Managed identity env vars not available"));
    }

    const url = `${endpoint}?api-version=2019-08-01&resource=https://ossrdbms-aad.database.windows.net`;
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: { "X-IDENTITY-HEADER": header },
    };

    const mod = parsedUrl.protocol === "https:" ? https : require("http");
    const req = mod.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Token request failed (${res.statusCode}): ${data}`));
        }
        try {
          const json = JSON.parse(data);
          resolve(json.access_token);
        } catch (e) {
          reject(new Error(`Failed to parse token response: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const pgHost = process.env.AZURE_POSTGRESQL_HOST;

  if (pgHost) {
    console.log("[startup] Azure environment detected — acquiring token for Prisma migration...");

    try {
      const accessToken = await getAccessToken();
      console.log("[startup] Managed identity token acquired.");

      const dbUser = process.env.AZURE_POSTGRESQL_USER;
      const dbName = process.env.AZURE_POSTGRESQL_DATABASE || "sport_predictor";
      const token = encodeURIComponent(accessToken);

      // Set DATABASE_URL with the token as password for Prisma CLI
      process.env.DATABASE_URL = `postgresql://${dbUser}:${token}@${pgHost}:5432/${dbName}?schema=public&sslmode=require`;

      console.log("[startup] Running prisma migrate deploy...");
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      console.log("[startup] Migrations complete.");
    } catch (err) {
      console.error("[startup] Migration failed (app will start anyway):", err.message);
      // Don't block startup — the schema might already be up to date
    }
  } else {
    console.log("[startup] Local environment — skipping managed identity migration.");
  }

  console.log("[startup] Starting Next.js server...");
  execSync("npm run start", { stdio: "inherit" });
}

main().catch((err) => {
  console.error("[startup] Fatal error:", err);
  process.exit(1);
});
