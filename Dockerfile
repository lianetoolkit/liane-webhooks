FROM node:11-alpine

ARG UID=991
ARG GID=991

EXPOSE 8000

WORKDIR /liane-webhooks

RUN apk -U upgrade \
  && apk add \
     ca-certificates \
     file \
     git \
     tini \
  && update-ca-certificates \
  && rm -rf /tmp/* /var/cache/apk/*

RUN addgroup -g ${GID} liane-webhooks \
  && adduser -h /liane-webhooks -s /bin/sh -D -G liane-webhooks -u ${UID} liane-webhooks

# Copy files
COPY . /liane-webhooks

# Install app dependencies
RUN npm install --production=false \
  && npm run build

RUN chown -R liane-webhooks:liane-webhooks /liane-webhooks

USER liane-webhooks

ENTRYPOINT ["/sbin/tini", "--"]

# Run node server
CMD ["node", "dist/"]
