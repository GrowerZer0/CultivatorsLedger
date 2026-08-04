import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create a new ratelimiter that allows 5 requests per 10 minutes
export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "10 m"),
  analytics: true,
});

// Usage in a server action:
// const { success } = await ratelimit.limit(userId);
// if (!success) throw new Error("Rate limit exceeded");