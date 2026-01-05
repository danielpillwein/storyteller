# Use official Node.js 18 alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy root package.json for frontend dependencies (if needed by build, though redundant for runtime)
COPY package.json ./
RUN npm install --omit=dev

# Copy backend package.json and install dependencies
COPY backend/package.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy project files
COPY . .

# Expose port (default 3000)
EXPOSE 3000

# Set environment variable
ENV NODE_ENV=production
ENV PORT=3000

# Start server
CMD ["node", "backend/server.js"]
