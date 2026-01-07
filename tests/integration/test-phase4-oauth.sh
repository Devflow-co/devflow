#!/bin/bash

# Phase 4 OAuth Testing Script
# Tests Token Refresh Service and OAuth flow

API_URL="http://localhost:3000/api/v1"

# PROJECT_ID is required
if [ -z "$PROJECT_ID" ]; then
  echo "❌ PROJECT_ID environment variable is required"
  echo ""
  echo "Usage:"
  echo "  PROJECT_ID=\"your-project-id\" ./tests/integration/test-phase4-oauth.sh"
  exit 1
fi

echo "========================================="
echo "Phase 4 OAuth Testing"
echo "========================================="
echo ""

# Test 1: Check API health
echo "1. Testing API health..."
curl -s "$API_URL/health" | python3 -m json.tool
echo ""

# Test 2: Get current OAuth connections
echo "2. Checking existing OAuth connections..."
curl -s "$API_URL/auth/connections?project=$PROJECT_ID" | python3 -m json.tool
echo ""

# Test 3: Initiate GitHub OAuth
echo "3. Initiating GitHub Device Flow..."
RESPONSE=$(curl -s -X POST "$API_URL/auth/github/device/initiate" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"$PROJECT_ID\"}")

echo "$RESPONSE" | python3 -m json.tool
echo ""

USER_CODE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('userCode', ''))")
DEVICE_CODE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('deviceCode', ''))")
VERIFICATION_URI=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('verificationUri', ''))")

if [ -n "$USER_CODE" ]; then
  echo "========================================="
  echo "✅ Phase 4 OAuth Initiation Successful!"
  echo "========================================="
  echo ""
  echo "To complete the OAuth flow:"
  echo "1. Open: $VERIFICATION_URI"
  echo "2. Enter code: $USER_CODE"
  echo ""
  echo "Then run this to poll for completion:"
  echo "curl -X POST $API_URL/auth/github/device/poll \\"
  echo "  -H 'Content-Type: application/json' \\"
  echo "  -d '{\"deviceCode\": \"$DEVICE_CODE\", \"projectId\": \"$PROJECT_ID\"}'"
  echo ""
else
  echo "❌ Failed to initiate OAuth"
fi

# Test 4: Test error handling (no OAuth configured)
echo "4. Testing error handling (project without OAuth)..."
curl -s "$API_URL/auth/connections?project=non-existent-project" | python3 -m json.tool
echo ""

echo "========================================="
echo "Phase 4 Testing Complete"
echo "========================================="
