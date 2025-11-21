"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const queue_1 = require("../src/infrastructure/queue");
const prisma = new client_1.PrismaClient();
const seed = async () => {
    console.log('Seeding 5 concurrent orders...');
    const orders = Array.from({ length: 5 }).map((_, i) => ({
        input_token: 'SOL',
        output_token: 'USDC',
        amount: 10 + i, // Different amounts
        status: 'PENDING',
    }));
    // Create orders in DB
    const createdOrders = await Promise.all(orders.map((data) => prisma.order.create({
        data: {
            ...data,
            status: 'PENDING', // Explicitly cast string to enum if needed, but Prisma handles it
        },
    })));
    // Add to Queue
    await Promise.all(createdOrders.map((order) => queue_1.orderQueue.add('process-order', { orderId: order.id })));
    console.log(`Submitted ${createdOrders.length} orders.`);
    // In a real scenario, we would listen to WebSocket or check DB for updates
    // Since we can't easily run the full stack here without Docker, we just log the IDs
    console.log('Order IDs:', createdOrders.map(o => o.id));
    await prisma.$disconnect();
};
seed().catch((e) => {
    console.error(e);
    process.exit(1);
});
