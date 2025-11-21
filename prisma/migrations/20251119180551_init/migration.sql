-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ROUTING', 'BUILDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "input_token" TEXT NOT NULL,
    "output_token" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "execution_logs" JSONB NOT NULL DEFAULT '[]',
    "tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
