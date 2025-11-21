import { Job } from 'bullmq';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { createWorker } from '../infrastructure/queue';
import { MockDexRouter, SlippageError } from '../domain/MockDexRouter';
import { redisPublisher } from '../infrastructure/redis';

const prisma = new PrismaClient();
const router = new MockDexRouter();

interface OrderJobData {
    orderId: string;
}

export const processOrder = async (job: Job<OrderJobData>) => {
    const { orderId } = job.data;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
        throw new Error(`Order ${orderId} not found`);
    }

    if (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.FAILED) {
        console.log(`Order ${orderId} already processed`);
        return;
    }

    const log = async (status: OrderStatus, message: string) => {
        const entry = { status, timestamp: new Date().toISOString(), message };
        await prisma.order.update({
            where: { id: orderId },
            data: {
                status,
                execution_logs: {
                    push: entry,
                },
            },
        });

        // Publish event
        await redisPublisher.publish('order-updates', JSON.stringify({ orderId, ...entry }));
    };

    try {
        // 1. Routing
        await log(OrderStatus.ROUTING, 'Finding best route...');
        const quote = await router.getQuote(Number(order.amount));

        // 2. Building
        await log(OrderStatus.BUILDING, `Quote received: ${quote.provider} @ ${quote.price}`);

        // Simulate building tx
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 3. Submitted
        await log(OrderStatus.SUBMITTED, 'Transaction submitted to network');

        // 4. Execute Swap
        const result = await router.executeSwap(quote);

        // 5. Confirmed
        await prisma.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.CONFIRMED,
                tx_hash: result.txHash,
                execution_logs: {
                    push: { status: OrderStatus.CONFIRMED, timestamp: new Date().toISOString(), message: `Swap confirmed. Final Price: ${result.finalPrice}` },
                },
            },
        });
        await redisPublisher.publish('order-updates', JSON.stringify({
            orderId,
            status: OrderStatus.CONFIRMED,
            txHash: result.txHash,
            message: 'Swap confirmed'
        }));

    } catch (error: any) {
        if (error instanceof SlippageError) {
            await log(OrderStatus.FAILED, `Slippage error: ${error.message}`);
            // Do not rethrow, so BullMQ doesn't retry
        } else {
            // Network or other errors - Do NOT set status to FAILED yet, as we want to retry.
            // Just log to console or maybe append to execution logs without changing status?
            // For now, simple console log. The 'failed' event will handle the final FAILED status if retries are exhausted.
            console.error(`Job ${job.id} attempt failed: ${error.message}. Retrying...`);
            throw error; // Rethrow to trigger BullMQ retry
        }
    }
};

export const startWorker = () => {
    const worker = createWorker(processOrder);

    worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed`);
    });

    worker.on('failed', async (job, err) => {
        console.log(`Job ${job?.id} failed permanently: ${err.message}`);
        
        if (job && job.data && job.data.orderId) {
             const { orderId } = job.data as OrderJobData;
             try {
                // Mark as FAILED in DB
                const entry = { status: OrderStatus.FAILED, timestamp: new Date().toISOString(), message: `Order failed after retries: ${err.message}` };
                await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        status: OrderStatus.FAILED,
                        execution_logs: {
                            push: entry
                        }
                    }
                });
                
                // Publish event
                await redisPublisher.publish('order-updates', JSON.stringify({ orderId, ...entry }));
             } catch (dbErr) {
                 console.error('Failed to update order status on worker failure', dbErr);
             }
        }
    });

    console.log('Worker started');
};
