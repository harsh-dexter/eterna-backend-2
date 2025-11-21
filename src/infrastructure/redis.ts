import Redis from 'ioredis';

const getClient = () => {
    const url = process.env.REDIS_URL || process.env.REDIS_HOST;
    
    if (url && (url.startsWith('redis://') || url.startsWith('rediss://'))) {
        return new Redis(url, {
            maxRetriesPerRequest: null,
        });
    }

    return new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        maxRetriesPerRequest: null,
    });
};

// Shared Redis connection for general use
export const redis = getClient();

// Publisher for Pub/Sub
export const redisPublisher = getClient();

// Subscriber for Pub/Sub
export const redisSubscriber = getClient();

export const getRedisConnection = () => getClient();
