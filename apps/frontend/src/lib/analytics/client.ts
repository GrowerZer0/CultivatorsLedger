// src/lib/analytics/client.ts
import posthog from 'posthog-js';
import { useEffect } from 'react';

export function initPostHogClient() {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    console.warn('NEXT_PUBLIC_POSTHOG_KEY is not set. Client analytics disabled.');
    return;
  }
  if (typeof window !== 'undefined') {
    posthog.init(apiKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      // Enable if you want to capture page views automatically
      capture_pageview: false, // we'll handle manually or use 'pageview' event
    });
  }
}

export function getPostHogClient() {
  return posthog;
}

/**
 * Track an event client-side.
 */
export function trackClientEvent(
  eventName: string,
  properties: Record<string, any> = {}
) {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture(eventName, properties);
  }
}

/**
 * Identify user client-side.
 */
export function identifyClientUser(
  userId: string,
  traits: Record<string, any> = {}
) {
  if (typeof window !== 'undefined' && posthog) {
    posthog.identify(userId, traits);
  }
}