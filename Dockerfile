# Development image. Production runs on Vercel, which builds from source.
FROM node:24-slim

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
RUN node .yarn/releases/yarn-*.cjs install --immutable

COPY . .

EXPOSE 3000
CMD ["sh", "-c", "node .yarn/releases/yarn-*.cjs dev --hostname 0.0.0.0"]
