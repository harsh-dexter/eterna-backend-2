import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import cors from '@fastify/cors';
import path from 'path';
import { orderRoutes } from './routes/orderRoutes';
import { websocketRoutes } from './websocket';

export const buildServer = () => {
    const server = Fastify({
        logger: true,
    });

    server.register(cors);

    // Register Websocket
    server.register(websocket);

    // Serve Static Files (Frontend)
    server.register(fastifyStatic, {
        root: path.join(process.cwd(), 'public'),
        prefix: '/', // optional: default '/'
    });

    // Register Routes
    server.register(orderRoutes, { prefix: '/api' });
    server.register(websocketRoutes, { prefix: '/api' });

    server.get('/health', async () => {
        return { status: 'ok' };
    });

    return server;
};
