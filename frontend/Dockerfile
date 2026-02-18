# Build stage
FROM node:20-alpine as build

ARG VITE_UI_LANG=de
ENV VITE_UI_LANG=$VITE_UI_LANG

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
