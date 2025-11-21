import dotenv from 'dotenv';
dotenv.config();

import { buildServer } from './api/server';
import { startWorker } from './workers/orderWorker';
import { redis } from './infrastructure/redis';

const start = async () => {
    // Configure Redis (Silence BullMQ warning if possible)
    try {
        await redis.config('SET', 'maxmemory-policy', 'noeviction');
        console.log('Successfully set Redis maxmemory-policy to noeviction');
    } catch (err: any) {
        console.warn(`Warning: Could not set Redis eviction policy: ${err.message}`);
        console.warn('Ensure your Redis instance is configured with "noeviction" to avoid job loss.');
    }

    // Start Worker
    startWorker();

    // Start Server
    const server = buildServer();
    try {
        const port = Number(process.env.PORT) || 3000;
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`Server running on port ${port}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
