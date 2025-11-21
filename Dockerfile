FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

EXPOSE 3000

# Use the start script (node dist/src/app.js)
# Run migrations before starting
CMD sh -c "npx prisma migrate deploy && npm run start"
