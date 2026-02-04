FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (vscode user for VS Code dev containers)
RUN useradd -m -s /bin/bash -u 1000 vscode && \
    echo "vscode ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up workspace
WORKDIR /workspace
RUN chown -R vscode:vscode /workspace

USER vscode

CMD ["sleep", "infinity"]
