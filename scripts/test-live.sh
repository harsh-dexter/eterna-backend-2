#!/bin/bash

# Start server in background
echo "Starting server..."
npm run dev > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 10

# Check health
echo "Checking health..."
curl -s http://localhost:3000/health
echo ""

# Create Order
echo "Creating order..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"input_token": "SOL", "output_token": "USDC", "amount": 1.5}')

echo "Response: $RESPONSE"

# Extract Order ID (simple grep/sed/awk since jq might not be available, but env said jq is available)
ORDER_ID=$(echo $RESPONSE | jq -r '.orderId')

if [ "$ORDER_ID" != "null" ] && [ -n "$ORDER_ID" ]; then
    echo "Order ID: $ORDER_ID"
    
    # Give worker time to process
    echo "Waiting for worker to process..."
    sleep 5
    
    # We can't easily check the WS update via curl, but we can check the server logs
    echo "Server Logs (last 20 lines):"
    tail -n 20 server.log
else
    echo "Failed to get Order ID"
    cat server.log
fi

# Kill server
echo "Stopping server..."
kill $SERVER_PID
