FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY . .
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "--experimental-strip-types", "src/server.ts"]
