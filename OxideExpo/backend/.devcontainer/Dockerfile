FROM rust:1.75-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    postgresql-client \
    git \
    curl \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install cargo tools
RUN cargo install cargo-watch sqlx-cli

# Create non-root user
RUN useradd -m -s /bin/bash -u 1000 developer && \
    echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up workspace
WORKDIR /workspace
RUN chown -R developer:developer /workspace

# Set up cargo home
ENV CARGO_HOME=/usr/local/cargo
RUN mkdir -p $CARGO_HOME && chown -R developer:developer $CARGO_HOME

USER developer

CMD ["sleep", "infinity"]
