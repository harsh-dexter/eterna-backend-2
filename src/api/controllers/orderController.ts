import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { orderQueue } from '../../infrastructure/queue';
import { z } from 'zod';

const prisma = new PrismaClient();

const orderSchema = z.object({
    input_token: z.string(),
    output_token: z.string(),
    amount: z.number().positive(),
});

export const createOrder = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { input_token, output_token, amount } = orderSchema.parse(req.body);

        // 1. Create Order in DB
        const order = await prisma.order.create({
            data: {
                input_token,
                output_token,
                amount,
                status: 'PENDING',
            },
        });

        // 2. Add to Queue
        await orderQueue.add('execute-order', { orderId: order.id }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
        });

        return reply.code(201).send({
            message: 'Order received',
            orderId: order.id,
            status: order.status,
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return reply.code(400).send({ error: 'Invalid input', details: error.errors });
        }
        console.error(error);
        return reply.code(500).send({ error: 'Internal Server Error' });
    }
};
