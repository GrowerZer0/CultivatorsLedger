import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

function getPostHogClient(): PostHog {
  if (!posthogClient) {
    const apiKey = process.env.POSTHOG_API_KEY;
    if (!apiKey) {
      console.warn('POSTHOG_API_KEY is not set. Analytics will be disabled.');
      posthogClient = new PostHog('dummy', { host: 'https://app.posthog.com' });
    } else {
      posthogClient = new PostHog(apiKey, {
        host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
      });
    }
  }
  return posthogClient;
}

export async function trackEvent(
  eventName: string,
  properties: Record<string, any> = {},
  userId?: string
) {
  if (!userId) {
    console.warn('trackEvent called without userId, event will not be sent.');
    return;
  }
  const client = getPostHogClient();
  try {
    client.capture({
      distinctId: userId,
      event: eventName,
      properties,
    });
    // Shutdown to flush events before serverless function exits
    await client.shutdown();
  } catch (error) {
    console.error('Error tracking event:', error);
  }
}

export async function identifyUser(
  userId: string,
  traits: Record<string, any> = {}
) {
  const client = getPostHogClient();
  try {
    client.identify({
      distinctId: userId,
      properties: traits,
    });
    await client.shutdown();
  } catch (error) {
    console.error('Error identifying user:', error);
  }
}