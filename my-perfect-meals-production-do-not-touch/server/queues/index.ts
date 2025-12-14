import { Queue, Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";

// Temporarily disable Redis to fix connection errors
// TODO: Re-enable when proper Redis instance is available
console.log('📡 Redis temporarily disabled to prevent connection errors');

// Mock queue for now
export const smsQueue = {
  add: (jobName: string, data: any, options?: any) => {
    console.log('📱 SMS job queued (mock):', jobName, data);
    return Promise.resolve({ id: 'mock-job-' + Date.now() });
  }
};

export type SmsJobData = {
  userId: string; 
  toE164: string; 
  body: string; 
  reminderId?: string;
};

export const defaultJobOpts: JobsOptions = { 
  removeOnComplete: 1000, 
  removeOnFail: 1000 
};