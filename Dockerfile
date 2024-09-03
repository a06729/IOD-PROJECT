# Build app
FROM node:19 AS builder

# Set working directory
WORKDIR /home/node/app

# Copy package.json and package-lock.json and install dependencies
COPY package.json package-lock.json* ./
# RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the Next.js app
RUN npm run build

# Prod image
FROM node:19 AS runner

# Set working directory
WORKDIR /home/node/app

# Copy built files from builder stage
COPY --from=builder /home/node/app/.next ./.next
COPY --from=builder /home/node/app/public ./public
COPY --from=builder /home/node/app/node_modules ./node_modules
COPY --from=builder /home/node/app/package.json ./package.json

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start the Next.js app
CMD ["npm", "start"]