#!/bin/bash

# DevFlow OAuth Flow Testing Script
# This script helps test the OAuth flows for GitHub and Linear

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ID="${1:-bebf5fce-2528-440b-986a-4cd93c783cc8}"
API_URL="${API_URL:-http://localhost:8000}"

echo -e "${BLUE}🔐 DevFlow OAuth Flow Testing${NC}"
echo "=================================="
echo ""
echo "Project ID: $PROJECT_ID"
echo "API URL: $API_URL"
echo ""

# Function to test API health
test_api_health() {
  echo -e "${YELLOW}🏥 Checking API health...${NC}"
  response=$(curl -s -w "\n%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")
  status_code=$(echo "$response" | tail -n 1)

  if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ API is healthy${NC}"
    return 0
  else
    echo -e "${RED}❌ API is not responding (status: $status_code)${NC}"
    echo "Please start the API with: pnpm --filter @devflow/api dev"
    return 1
  fi
}

# Function to test GitHub Device Flow
test_github_device_flow() {
  echo ""
  echo -e "${BLUE}📱 Testing GitHub Device Flow${NC}"
  echo "=================================="

  echo "1. Initiating device flow..."
  response=$(curl -s -X POST "$API_URL/api/v1/auth/github/device/initiate" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\": \"$PROJECT_ID\"}" 2>/dev/null || echo "")

  if [ -z "$response" ]; then
    echo -e "${RED}❌ Failed to initiate device flow${NC}"
    return 1
  fi

  echo -e "${GREEN}✅ Device flow initiated${NC}"
  echo "Response:"
  echo "$response" | jq '.' 2>/dev/null || echo "$response"

  # Extract device code and user code
  device_code=$(echo "$response" | jq -r '.deviceCode // empty' 2>/dev/null)
  user_code=$(echo "$response" | jq -r '.userCode // empty' 2>/dev/null)
  verification_uri=$(echo "$response" | jq -r '.verificationUri // empty' 2>/dev/null)

  if [ -n "$device_code" ] && [ -n "$user_code" ]; then
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "   1. Visit: $verification_uri"
    echo "   2. Enter code: $user_code"
    echo "   3. Authorize the application"
    echo ""
    echo -e "${YELLOW}⏱️  Polling for authorization (this may take a minute)...${NC}"
    echo ""

    # Poll for the token (max 10 attempts, 5 seconds each)
    for i in {1..10}; do
      echo -e "${BLUE}Attempt $i/10...${NC}"
      poll_response=$(curl -s -X POST "$API_URL/api/v1/auth/github/device/poll" \
        -H "Content-Type: application/json" \
        -d "{\"deviceCode\": \"$device_code\", \"projectId\": \"$PROJECT_ID\"}" 2>/dev/null || echo "")

      if echo "$poll_response" | jq -e '.accessToken' >/dev/null 2>&1; then
        echo -e "${GREEN}✅ GitHub OAuth connected successfully!${NC}"
        echo "Response:"
        echo "$poll_response" | jq '.' 2>/dev/null || echo "$poll_response"
        return 0
      fi

      # Check for errors
      if echo "$poll_response" | jq -e '.error' >/dev/null 2>&1; then
        error=$(echo "$poll_response" | jq -r '.error')
        if [ "$error" != "authorization_pending" ]; then
          echo -e "${RED}❌ Error: $error${NC}"
          return 1
        fi
      fi

      sleep 5
    done

    echo -e "${YELLOW}⚠️  Polling timed out. You can continue polling manually.${NC}"
  else
    echo -e "${RED}❌ Failed to extract device code from response${NC}"
    return 1
  fi
}

# Function to test Linear Authorization Code Flow
test_linear_auth_flow() {
  echo ""
  echo -e "${BLUE}🔗 Testing Linear Authorization Code Flow${NC}"
  echo "=================================="

  echo "1. Getting authorization URL..."
  response=$(curl -s -X POST "$API_URL/api/v1/auth/linear/authorize" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\": \"$PROJECT_ID\"}" 2>/dev/null || echo "")

  if [ -z "$response" ]; then
    echo -e "${RED}❌ Failed to get authorization URL${NC}"
    return 1
  fi

  echo -e "${GREEN}✅ Authorization URL generated${NC}"
  echo "Response:"
  echo "$response" | jq '.' 2>/dev/null || echo "$response"

  auth_url=$(echo "$response" | jq -r '.authorizationUrl // empty' 2>/dev/null)

  if [ -n "$auth_url" ]; then
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "   1. Visit the URL below:"
    echo "   $auth_url"
    echo "   2. Authorize the application"
    echo "   3. You'll be redirected to the callback URL"
    echo "   4. The API will handle the token exchange automatically"
    echo ""
    echo -e "${GREEN}Opening browser...${NC}"

    # Try to open the URL in the default browser
    if command -v open &> /dev/null; then
      open "$auth_url"
    elif command -v xdg-open &> /dev/null; then
      xdg-open "$auth_url"
    else
      echo "Please manually open the URL above in your browser."
    fi
  else
    echo -e "${RED}❌ Failed to extract authorization URL from response${NC}"
    return 1
  fi
}

# Function to check OAuth connections
check_connections() {
  echo ""
  echo -e "${BLUE}🔍 Checking OAuth Connections${NC}"
  echo "=================================="

  response=$(curl -s "$API_URL/api/v1/auth/connections?project=$PROJECT_ID" 2>/dev/null || echo "")

  if [ -z "$response" ]; then
    echo -e "${RED}❌ Failed to fetch connections${NC}"
    return 1
  fi

  echo "Response:"
  echo "$response" | jq '.' 2>/dev/null || echo "$response"
}

# Main menu
show_menu() {
  echo ""
  echo -e "${BLUE}Choose an option:${NC}"
  echo "1. Test GitHub Device Flow"
  echo "2. Test Linear Authorization Code Flow"
  echo "3. Check OAuth Connections"
  echo "4. Run all tests"
  echo "5. Exit"
  echo ""
  read -p "Enter choice [1-5]: " choice

  case $choice in
    1) test_github_device_flow ;;
    2) test_linear_auth_flow ;;
    3) check_connections ;;
    4)
      test_github_device_flow
      test_linear_auth_flow
      check_connections
      ;;
    5) exit 0 ;;
    *) echo -e "${RED}Invalid option${NC}" ;;
  esac

  show_menu
}

# Main
if ! test_api_health; then
  exit 1
fi

# If arguments provided, run specific test
if [ "$2" = "github" ]; then
  test_github_device_flow
elif [ "$2" = "linear" ]; then
  test_linear_auth_flow
elif [ "$2" = "check" ]; then
  check_connections
else
  show_menu
fi
