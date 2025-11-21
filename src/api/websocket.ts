import { FastifyInstance } from 'fastify';
import { redisSubscriber } from '../infrastructure/redis';
import { WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const websocketRoutes = async (fastify: FastifyInstance) => {
    fastify.get('/orders/:orderId', { websocket: true }, async (socket: WebSocket, req: any) => {
        const { orderId } = req.params;
        console.log(`Client connected for order ${orderId}`);

        // Send existing logs first to catch up
        try {
            const order = await prisma.order.findUnique({ where: { id: orderId } });
            if (order && order.execution_logs) {
                const logs = order.execution_logs;
                if (Array.isArray(logs)) {
                    logs.forEach((log: any) => {
                        socket.send(JSON.stringify({ orderId, ...log }));
                    });
                } else {
                    console.warn(`Order ${orderId} logs is not an array:`, logs);
                }
            }
        } catch (error) {
            console.error('Error fetching order history', error);
        }

        const handler = (channel: string, message: string) => {
            if (channel === 'order-updates') {
                const data = JSON.parse(message);
                if (data.orderId === orderId) {
                    socket.send(JSON.stringify(data));
                }
            }
        };

        redisSubscriber.subscribe('order-updates');
        redisSubscriber.on('message', handler);

        socket.on('close', () => {
            console.log(`Client disconnected for order ${orderId}`);
            redisSubscriber.removeListener('message', handler);
        });
    });
};
