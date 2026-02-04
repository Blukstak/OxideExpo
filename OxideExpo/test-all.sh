#!/bin/bash
set -e

echo "🧪 Running Backend Integration Tests..."
cd backend
cargo test --test '*' -- --test-threads=1

echo ""
echo "✅ Backend tests passed!"

echo ""
echo "🌐 Running Frontend E2E Tests..."
cd ../frontend

# Check if Playwright is installed
if [ ! -d "node_modules/@playwright" ]; then
    echo "Installing Playwright..."
    npm install
    npx playwright install
fi

npm run test:e2e

echo ""
echo "✅ All tests passed! 🎉"
