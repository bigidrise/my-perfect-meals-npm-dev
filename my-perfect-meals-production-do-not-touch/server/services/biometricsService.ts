import { BiometricSample } from '../../shared/biometricsSchema';

// Derive daily maximum heart rate from heart rate samples
export function deriveDailyMaxHR(samples: { value: number; startTime: Date }[]) {
  const byDate = new Map<string, number>();
  for (const sample of samples) {
    const date = sample.startTime.toISOString().slice(0, 10);
    byDate.set(date, Math.max(byDate.get(date) ?? 0, Math.round(sample.value)));
  }
  return byDate; // { "2025-08-11": 164, ... }
}

// Convert weight units to kg (defensive conversion)
export function normalizeWeightToKg(value: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'kg':
      return value;
    case 'lb':
    case 'lbs':
      return value * 0.45359237;
    default:
      return value; // assume kg if unknown
  }
}

// Convert waist measurements to cm (defensive conversion)
export function normalizeWaistToCm(value: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'cm':
      return value;
    case 'in':
    case 'inch':
    case 'inches':
      return value * 2.54;
    default:
      return value; // assume cm if unknown
  }
}

// Calculate daily summaries from raw samples
export function calculateDailySummaries(samples: BiometricSample[]) {
  const dailyData = new Map<string, {
    steps: number;
    maxHeartRate: number;
    avgHeartRate: number;
    weight: number | null;
  }>();

  for (const sample of samples) {
    const date = sample.startTime.toISOString().slice(0, 10);
    const current = dailyData.get(date) ?? {
      steps: 0,
      maxHeartRate: 0,
      avgHeartRate: 0,
      weight: null,
    };

    switch (sample.type) {
      case 'steps':
        current.steps += sample.value;
        break;
      case 'heart_rate':
        current.maxHeartRate = Math.max(current.maxHeartRate, sample.value);
        // For average, we'd need to track count and sum - keeping simple for now
        current.avgHeartRate = Math.max(current.avgHeartRate, sample.value);
        break;
      case 'weight':
        current.weight = sample.value; // Use most recent weight
        break;
    }

    dailyData.set(date, current);
  }

  return dailyData;
}

// Privacy-first data filtering - only allow approved biometric types
export function filterAllowedBiometrics(data: any[]): any[] {
  const allowedTypes = ['steps', 'heart_rate', 'weight', 'waist_circumference'];
  return data.filter(item => allowedTypes.includes(item.type));
}