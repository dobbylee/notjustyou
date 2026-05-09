import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

let redis: Promise<RedisClient> | undefined;

export function getRedis() {
  redis ??= connectRedis().catch((error) => {
    redis = undefined;
    throw error;
  });

  return redis;
}

async function connectRedis() {
  const url = process.env.REDIS_URL?.trim();

  if (!url) {
    throw new Error(
      "REDIS_URL is required. Start local Redis with `docker compose up -d redis` and set REDIS_URL=redis://localhost:6379.",
    );
  }

  const client = createClient({
    url,
  });

  client.on("error", (error) => {
    console.error("Redis client error", error);
  });

  await client.connect();
  return client;
}
