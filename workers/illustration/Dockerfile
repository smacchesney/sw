# ---- build ----
# Use a specific Node.js 20 Alpine image for smaller size
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies using lockfile
# Using ci ensures a clean, reproducible install based on package-lock.json
RUN npm ci --omit=dev

# 2. generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# 3. Compile ONLY the worker TypeScript code
# This uses tsconfig.worker.json and outputs to dist-worker/
RUN npm run build:worker

# ---- run ----
# Start from a clean Node.js Alpine image
FROM node:20-alpine

WORKDIR /app

# Copy only necessary artifacts from the build stage
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist-worker ./dist-worker
# Copy Prisma schema if needed at runtime (e.g., by the client)
COPY --from=build /app/prisma ./prisma 
# Copy compiled Prisma client if it's generated during build (adjust path if needed)
# COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma 
# Copy any other necessary runtime files (e.g., .env might be handled by Railway secrets)

# Set the command to run the ILLUSTRATION generation worker
# Ensure the path matches the output of build:worker
CMD ["node", "dist-worker/src/queues/workers/illustration-generation.worker.js"] 