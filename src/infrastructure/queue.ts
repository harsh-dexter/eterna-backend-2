import { Queue, Worker, QueueOptions, WorkerOptions } from 'bullmq';
import { getRedisConnection } from './redis';

const QUEUE_NAME = 'order-execution-queue';

const queueConfig: QueueOptions = {
    connection: getRedisConnection(),
    defaultJobOptions: {
        removeOnComplete: {
            count: 1000, // Keep last 1000 completed jobs
            age: 24 * 3600, // Or jobs older than 24h
        },
        removeOnFail: {
            count: 5000, // Keep failed jobs for inspection
        },
    },
};

export const orderQueue = new Queue(QUEUE_NAME, queueConfig);

export const createWorker = (processor: any) => {
    const workerConfig: WorkerOptions = {
        connection: getRedisConnection(),
        concurrency: 10,
        limiter: {
            max: 100,
            duration: 60000, // 1 minute
        },
    };

    return new Worker(QUEUE_NAME, processor, workerConfig);
};
