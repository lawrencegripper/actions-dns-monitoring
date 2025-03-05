# Stage 1: Get go binaries built for bookworm
FROM golang:1.23-bookworm AS golang-binaries

# Stage 2: Main container
FROM mcr.microsoft.com/devcontainers/typescript-node:20

USER root

# # Install additional packages
# COPY ./script/linux-dependencies /tmp/linux-dependencies
# RUN /tmp/linux-dependencies

# # Copy Go binaries from the golang-builder stage
# COPY --from=golang-binaries /usr/local/go /usr/local/go

# # Set Go environment variables
# ENV PATH="/usr/local/go/bin:${PATH}"
# ENV GOPATH /go
# RUN mkdir -p "$GOPATH/src" "$GOPATH/bin" && chmod -R 1777 "$GOPATH"

# Avoid git safety messages on codespace build
RUN git config --global --add safe.directory '*'