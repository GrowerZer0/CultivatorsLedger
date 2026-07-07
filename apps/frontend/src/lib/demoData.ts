// src/lib/demoData.ts
export interface DemoReading {
  timestamp: Date;
  temperature: number; // °C
  humidity: number; // %
  vpd: number;
  weight?: number;
}

export function generateDemoData(hours: number = 24): DemoReading[] {
  console.log('🧪 Demo mode activated, generating mock data');
  const now = new Date();
  const data: DemoReading[] = [];
  
  for (let i = 0; i < hours; i++) {
    const timestamp = new Date(now.getTime() - (hours - 1 - i) * 3600000);
    const hour = timestamp.getHours();
    
    // Simulate diurnal cycle: warmer during day, cooler at night
    const tempBase = 22 + 3 * Math.sin((hour - 6) * Math.PI / 12);
    const temp = tempBase + (Math.random() - 0.5) * 2;
    
    // Humidity inversely related to temperature
    const humidityBase = 60 + 15 * Math.cos((hour - 6) * Math.PI / 12);
    const humidity = humidityBase + (Math.random() - 0.5) * 3;
    
    // VPD derived from temp and humidity
    const vpd = 0.8 + 0.4 * Math.sin((hour - 6) * Math.PI / 12) + (Math.random() - 0.5) * 0.2;
    
    // Simulate dry‑back weight: gradual decrease over 24h with slight noise
    const weight = 16 - (i / hours) * 4 + (Math.random() - 0.5) * 0.5;
    
    data.push({
      timestamp,
      temperature: Math.round(temp * 10) / 10,
      humidity: Math.round(humidity * 10) / 10,
      vpd: Math.round(vpd * 100) / 100,
      weight: Math.round(weight * 10) / 10,
    });
  }
  
  return data;
}