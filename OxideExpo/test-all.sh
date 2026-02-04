#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Checking Docker containers...${NC}"

# Check if containers are running
if ! docker ps | grep -q empleos_backend_dev; then
    echo -e "${RED}Error: Backend container not running${NC}"
    echo "Start containers with: docker compose -f docker-compose.dev.yml up -d"
    exit 1
fi

if ! docker ps | grep -q empleos_frontend_dev; then
    echo -e "${RED}Error: Frontend container not running${NC}"
    echo "Start containers with: docker compose -f docker-compose.dev.yml up -d"
    exit 1
fi

echo -e "${GREEN}All containers running${NC}"
echo ""

# Backend tests
echo -e "${YELLOW}Running Backend Integration Tests...${NC}"
docker exec -e TEST_DATABASE_URL=postgresql://postgres:postgres@db:5432/empleos_inclusivos \
    empleos_backend_dev cargo test --test '*' -- --test-threads=1

echo ""
echo -e "${GREEN}Backend tests passed!${NC}"
echo ""

# Frontend tests
echo -e "${YELLOW}Running Frontend E2E Tests...${NC}"

# Check if Playwright browsers are installed
if ! docker exec empleos_frontend_dev test -d /root/.cache/ms-playwright; then
    echo -e "${YELLOW}Installing Playwright browsers (first time only)...${NC}"
    docker exec empleos_frontend_dev npx playwright install --with-deps chromium
fi

docker exec empleos_frontend_dev npm run test:e2e

echo ""
echo -e "${GREEN}All tests completed!${NC}"
