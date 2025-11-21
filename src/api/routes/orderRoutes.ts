import { FastifyInstance } from 'fastify';
import { createOrder } from '../controllers/orderController';

export const orderRoutes = async (fastify: FastifyInstance) => {
    fastify.post('/orders', createOrder);
};
