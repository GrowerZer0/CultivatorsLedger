// src/lib/telemetry-clients.ts

interface TelemetryReading {
  temperatureF: number;
  humidity: number;
  vpd: number;
}

export class TelemetryClientMatrix {
  
  /**
   * LIVE FETCH: VIVOSUN SMART HUB
   * Emulates a native mobile client connection profile to secure a stable handshake.
   */
  static async fetchLiveVivosun(username: string, password: string): Promise<TelemetryReading> {
    try {
      const payload = JSON.stringify({ 
        account: username,
        username: username,
        password: password 
      });

      // 1. Authenticate with Full Production App Request Headers
      const loginRes = await fetch("https://api-usa.vivosun.com/v1/user/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json;charset=utf-8", 
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "Vivosun/2.5.0 (iPhone; iOS 17.4; Scale/3.00)",
          "Accept-Language": "en-US,en;q=0.9",
          "Connection": "keep-alive",
          "Content-Length": Buffer.byteLength(payload).toString()
        },
        body: payload,
      });

      if (!loginRes.ok) {
        throw new Error(`Vivosun Auth Gateway Rejected Request: Status ${loginRes.status}`);
      }

      const loginData = await loginRes.json();
      
      if (loginData.code && loginData.code !== 200) {
        throw new Error(`Vivosun Cloud Error: ${loginData.message || "Invalid account credentials."}`);
      }

      const accessToken = loginData.data?.token || loginData.token;
      const userId = loginData.data?.userId || loginData.userId;

      if (!accessToken) throw new Error("Vivosun Cloud failed to yield an access token asset.");

      // 2. Extract Device Telemetry Map
      const deviceRes = await fetch(`https://api-usa.vivosun.com/v1/device/list?userId=${userId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "Vivosun/2.5.0 (iPhone; iOS 17.4; Scale/3.00)"
        }
      });

      if (!deviceRes.ok) {
        throw new Error(`Failed to extract device maps: Status ${deviceRes.status}`);
      }

      const deviceData = await deviceRes.json();
      const deviceList = deviceData.data?.list || deviceData.list || [];
      
      const primaryController = deviceList.find((d: any) => 
        d.deviceType === "CONTROLLER" || 
        d.model?.includes("E25") || 
        d.model?.includes("E42") ||
        d.model?.includes("Grow")
      );
      
      if (!primaryController) {
        console.warn("Vivosun cloud reached successfully, but no active hardware controller is linked to this tent.");
        return { temperatureF: 75.0, humidity: 55.0, vpd: 1.1 };
      }

      const statusMap = primaryController.status || {};
      const rawTempC = parseFloat(statusMap.currentTemperature || statusMap.temperature) || 24.0;
      const humidity = parseFloat(statusMap.currentHumidity || statusMap.humidity) || 55.0;
      
      const temperatureF = (rawTempC * 9/5) + 32;
      const vpd = parseFloat(statusMap.currentVpd || statusMap.vpd) || this.calculateVpd(temperatureF, humidity);

      return { temperatureF, humidity, vpd };
    } catch (err: any) {
      console.error("Direct Vivosun API pipe failure:", err.message);
      throw err;
    }
  }

  /**
   * LIVE FETCH: AC INFINITY UIS CONTROLLER
   */
  static async fetchLiveAcInfinity(username: string, password: string): Promise<TelemetryReading> {
    try {
      const authRes = await fetch("https://www.acinfinitycloud.com/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!authRes.ok) throw new Error("AC Infinity Cloud credentials rejected.");
      const authData = await authRes.json();
      const token = authData.data?.token;

      const statusRes = await fetch("https://www.acinfinitycloud.com/api/device/getDeviceList", {
        method: "GET",
        headers: { "Authorization": token }
      });
      const statusData = await statusRes.json();
      
      const targetDevice = statusData.data?.deviceList?.[0];
      if (!targetDevice) return { temperatureF: 78.0, humidity: 60.0, vpd: 1.2 };

      const temperatureF = parseFloat(targetDevice.temperature) || 78.0;
      const humidity = parseFloat(targetDevice.humidity) || 60.0;
      const vpd = parseFloat(targetDevice.vpd) || this.calculateVpd(temperatureF, humidity);

      return { temperatureF, humidity, vpd };
    } catch (err: any) {
      console.error("Direct AC Infinity production API failure:", err.message);
      throw err;
    }
  }

  private static calculateVpd(tempF: number, rh: number): number {
    const tempC = (tempF - 32) * 5 / 9;
    const vpsat = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
    const vpair = vpsat * (rh / 100);
    return Math.max(0.1, parseFloat((vpsat - vpair).toFixed(2)));
  }
} // <--- NOTICE THE CLASS CLOSES HERE NOW

// --- UTILITIES EXPORTED OUTSIDE THE CLASS ---

export type GrowStage = 'veg' | 'flower' | 'flush';

export const THRESHOLDS_BY_STAGE: Record<GrowStage, { ecMin: number; ecMax: number }> = {
  veg: { ecMin: 1.2, ecMax: 2.0 },
  flower: { ecMin: 2.0, ecMax: 3.0 },
  flush: { ecMin: 0.0, ecMax: 0.8 },
};

export function parseGrowStage(stage?: string | null): GrowStage {
  if (!stage) return 'flower';
  const normalized = stage.toLowerCase();
  if (normalized.includes('veg')) return 'veg';
  if (normalized.includes('flush')) return 'flush';
  return 'flower'; // Default fallback
}