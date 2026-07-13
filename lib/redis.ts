import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

let redis: Promise<RedisClient> | undefined;

export function getRedis(): Promise<RedisClient> {
  const current = redis ?? startRedisConnection();
  redis = current;

  return current.then((client) => {
    if (client.isOpen !== false && client.isReady !== false) return client;

    if (redis === current) {
      if (client.isOpen) client.destroy();
      redis = startRedisConnection();
    }

    return redis ?? getRedis();
  });
}

function startRedisConnection() {
  const connection = connectRedis();
  const cached = connection.catch((error) => {
    if (redis === cached) redis = undefined;
    throw error;
  });

  return cached;
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
    socket: {
      connectTimeout: 3_000,
      reconnectStrategy: (retries) =>
        retries >= 2
          ? new Error("Redis reconnect attempts exhausted.")
          : Math.min(50 * 2 ** retries, 500),
    },
  });

  client.on("error", (error) => {
    console.error("Redis client error", error);
  });
  await client.connect();
  return client;
}
