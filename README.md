# Order Execution Engine

A robust, scalable Order Execution Engine for DEX trading, built with TypeScript, Fastify, BullMQ, and Redis.

## Features

-   **Order Types**: Market Order execution.
    > **Why Market Order?**: I chose to implement Market Orders as they represent the most fundamental interaction with a DEX—executing a swap immediately at the best available price. This allows for a clear demonstration of the core routing and execution logic without the additional complexity of state management required for Limit orders (monitoring prices over time) or Sniper orders (monitoring chain events), while still providing a solid foundation that can be extended to support those types.
-   **Smart Routing**: Routes orders between Raydium and Meteora based on the best quoted price.
-   **Real-time Updates**: WebSocket streaming of order status (PENDING -> ROUTING -> SUBMITTED -> CONFIRMED).
-   **Worker-Queue Pattern**: Uses BullMQ for handling high throughput and retries.
-   **Slippage Protection**: Automatically fails transactions if price impact exceeds limits.

## Tech Stack

-   **Runtime**: Node.js + TypeScript
-   **API**: Fastify
-   **Database**: PostgreSQL (Prisma ORM)
-   **Queue**: BullMQ (Redis)
-   **Caching/PubSub**: Redis

## Project Structure

-   `src/api/`: API Server (HTTP & WebSocket).
-   `src/workers/`: Background workers for order processing.
-   `src/domain/`: Domain logic (DEX Routing simulation).
-   `src/infrastructure/`: Redis and Queue configuration.

## Setup & Run

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start Infrastructure (Postgres & Redis)**:
    ```bash
    docker-compose up -d
    ```

3.  **Database Migration**:
    ```bash
    npx prisma migrate dev --name init
    ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    This starts both the API server and the Worker.

## API Endpoints

### Create Order
`POST /api/orders`

Body:
```json
{
  "input_token": "SOL",
  "output_token": "USDC",
  "amount": 1.5
}
```

Response:
```json
{
  "message": "Order received",
  "orderId": "uuid...",
  "status": "PENDING"
}
```

### WebSocket Updates
Connect to: `ws://localhost:3000/api/orders/:orderId`

Receives updates:
```json
{
  "orderId": "...",
  "status": "ROUTING",
  "message": "Finding best route..."
}
```

## Design Decisions

-   **Microservices-ready**: The Worker is decoupled from the API. They run in the same process here for simplicity, but can be easily split.
-   **Mock DEX Router**: `MockDexRouter` simulates network latency and price variance to test slippage handling and async flows without real funds.
-   **Redis Pub/Sub**: Decouples the worker status updates from the WebSocket server. The worker publishes, the API subscribes.

## Extension for Other Order Types

To support **Limit Orders**, we would add a "Cron" job or a separate worker that checks `PENDING` Limit orders against current market prices periodically. When the target price is hit, it would push a job to the `execution-queue`.
To support **Sniper Orders**, we would listen to on-chain "New Pool" events. Upon detection of a target token launch, a job would be immediately pushed to the execution queue with high priority.
