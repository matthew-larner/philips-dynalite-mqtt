FROM node:11.4-alpine

ARG NODE_ENV
ENV NODE_ENV ${NODE_ENV}
RUN echo $NODE_ENV

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . .

# Install deps to build natively
RUN apk update && apk upgrade
RUN apk add --update nodejs nodejs-npm
RUN apk --no-cache --virtual build-dependencies add \
    python \
    make \
    g++ \
    && npm install \
    && rm -rf dist/ \
    && npm run build \
    && apk del build-dependencies

CMD [ "npm", "start" ]
