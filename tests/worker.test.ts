import { processOrder } from '../src/workers/orderWorker';
import { PrismaClient } from '@prisma/client';
import { redisPublisher } from '../src/infrastructure/redis';
import { MockDexRouter } from '../src/domain/MockDexRouter';

// Mocks
jest.mock('@prisma/client', () => {
    const mPrisma = {
        order: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };
    return {
        PrismaClient: jest.fn(() => mPrisma),
        OrderStatus: {
            PENDING: 'PENDING',
            ROUTING: 'ROUTING',
            BUILDING: 'BUILDING',
            SUBMITTED: 'SUBMITTED',
            CONFIRMED: 'CONFIRMED',
            FAILED: 'FAILED',
        }
    };
});

jest.mock('../src/infrastructure/redis', () => ({
    redisPublisher: {
        publish: jest.fn(),
    },
    getRedisConnection: jest.fn(),
}));

jest.mock('../src/infrastructure/queue', () => ({
    createWorker: jest.fn(() => ({
        on: jest.fn(),
    })),
    orderQueue: {
        add: jest.fn(),
    }
}));

jest.mock('../src/domain/MockDexRouter', () => {
    const mMockDexRouter = jest.fn();
    mMockDexRouter.prototype.getQuote = jest.fn();
    mMockDexRouter.prototype.executeSwap = jest.fn();

    return {
        MockDexRouter: mMockDexRouter,
        SlippageError: class SlippageError extends Error {
            constructor(message: string) {
                super(message);
                this.name = 'SlippageError';
            }
        }
    };
});

describe('Worker Logic', () => {
    let prisma: any;
    let mockJob: any;
    let mockRouter: any;

    beforeAll(() => {
        prisma = new PrismaClient();
        mockRouter = new MockDexRouter();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockJob = {
            data: { orderId: '123' },
        };
    });

    test('processOrder throws if order not found', async () => {
        (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(processOrder(mockJob)).rejects.toThrow('Order 123 not found');
    });

    test('processOrder skips if already CONFIRMED', async () => {
        (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: '123', status: 'CONFIRMED' });
        await processOrder(mockJob);
        expect(prisma.order.update).not.toHaveBeenCalled();
    });

    test('processOrder completes successfully', async () => {
        (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: '123', status: 'PENDING', amount: 10 });
        (MockDexRouter.prototype.getQuote as jest.Mock).mockResolvedValue({ provider: 'Raydium', price: 100, amountOut: 1000 });
        (MockDexRouter.prototype.executeSwap as jest.Mock).mockResolvedValue({ txHash: '0x123', finalPrice: 100, status: 'success' });

        await processOrder(mockJob);

        expect(prisma.order.update).toHaveBeenCalledTimes(4); 
        expect(redisPublisher.publish).toHaveBeenCalled();
    });

    test('processOrder handles SlippageError', async () => {
        (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: '123', status: 'PENDING', amount: 10 });
        (MockDexRouter.prototype.getQuote as jest.Mock).mockResolvedValue({ provider: 'Raydium', price: 100, amountOut: 1000 });
        
        // Mock executeSwap to throw SlippageError
        const { SlippageError } = require('../src/domain/MockDexRouter');
        (MockDexRouter.prototype.executeSwap as jest.Mock).mockRejectedValue(new SlippageError('Too high'));

        await processOrder(mockJob);

        // Should log FAILED and NOT rethrow
        expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'FAILED' })
        }));
    });

    test('processOrder rethrows generic errors without setting FAILED status', async () => {
        (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: '123', status: 'PENDING', amount: 10 });
        (MockDexRouter.prototype.getQuote as jest.Mock).mockRejectedValue(new Error('Network Error'));

        await expect(processOrder(mockJob)).rejects.toThrow('Network Error');
        
        // Should NOT set status to FAILED (so retry can happen)
        // It might have called update for ROUTING, but not FAILED
        expect(prisma.order.update).not.toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'FAILED' })
        }));
    });
});
