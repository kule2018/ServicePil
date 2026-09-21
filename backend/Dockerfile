# ServicePilot 后端镜像（多阶段构建：build → run）
# 运行 Node 22（与本地开发保持一致），构建产物为 dist/

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
