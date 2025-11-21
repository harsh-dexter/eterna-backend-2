import { buildServer } from '../src/api/server';
import { PrismaClient } from '@prisma/client';
import { orderQueue } from '../src/infrastructure/queue';

// Mock Prisma and Queue
jest.mock('@prisma/client', () => {
    const mPrisma = {
        order: {
            create: jest.fn(),
        },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('../src/infrastructure/queue', () => ({
    orderQueue: {
        add: jest.fn(),
    },
    createWorker: jest.fn(),
}));

describe('API Endpoints', () => {
    let app: any;
    let prisma: any;

    beforeAll(async () => {
        app = buildServer();
        await app.ready();
        prisma = new PrismaClient();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET /health returns 200', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/health',
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ status: 'ok' });
    });

    test('POST /api/orders creates order successfully', async () => {
        const mockOrder = { id: '123', status: 'PENDING' };
        (prisma.order.create as jest.Mock).mockResolvedValue(mockOrder);

        const response = await app.inject({
            method: 'POST',
            url: '/api/orders',
            payload: {
                input_token: 'SOL',
                output_token: 'USDC',
                amount: 10,
            },
        });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toHaveProperty('orderId', '123');
        expect(prisma.order.create).toHaveBeenCalled();
        expect(orderQueue.add).toHaveBeenCalledWith(
            'execute-order', 
            { orderId: '123' },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            }
        );
    });

    test('POST /api/orders returns 400 for invalid schema', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/orders',
            payload: {
                input_token: 'SOL',
                // Missing output_token
                amount: 10,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    test('POST /api/orders returns 400 for negative amount', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/orders',
            payload: {
                input_token: 'SOL',
                output_token: 'USDC',
                amount: -5,
            },
        });

        expect(response.statusCode).toBe(400);
    });
});
