#!/bin/bash

# End-to-End Workflow Test for DevFlow
# Creates a task, starts workflow, and monitors execution

set -e

API_URL="http://localhost:8000"
PROJECT_ID="82e6e9ee-76f3-430d-8d6f-8ba0a86391d6"
TEMPORAL_UI="http://localhost:8080"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   DevFlow End-to-End Workflow Test            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Create a task
echo -e "${BLUE}📝 Step 1: Creating a test task...${NC}"
TASK_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Add user authentication endpoint\",
    \"description\": \"Create a POST /api/auth/login endpoint that:\n- Accepts email and password\n- Validates credentials against database\n- Returns JWT token on success\n- Returns 401 on invalid credentials\n- Includes rate limiting\",
    \"projectId\": \"$PROJECT_ID\",
    \"priority\": \"high\"
  }")

echo "$TASK_RESPONSE" | jq '.'

TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.id // .task.id')

if [ -z "$TASK_ID" ] || [ "$TASK_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to create task${NC}"
  echo "Response: $TASK_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Task created: $TASK_ID${NC}"
echo ""

# Step 2: Start workflow
echo -e "${BLUE}🚀 Step 2: Starting workflow...${NC}"
WORKFLOW_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/workflows/start" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"taskId\": \"$TASK_ID\"
  }")

echo "$WORKFLOW_RESPONSE" | jq '.'

WORKFLOW_ID=$(echo "$WORKFLOW_RESPONSE" | jq -r '.workflowId // .workflow.workflowId // .id')

if [ -z "$WORKFLOW_ID" ] || [ "$WORKFLOW_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to start workflow${NC}"
  echo "Response: $WORKFLOW_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Workflow started: $WORKFLOW_ID${NC}"
echo ""

# Step 3: Monitor workflow
echo -e "${BLUE}👀 Step 3: Monitoring workflow...${NC}"
echo -e "${YELLOW}⏳ Waiting for workflow to progress (checking every 5 seconds)...${NC}"
echo ""

for i in {1..12}; do
  sleep 5

  WORKFLOW_STATUS=$(curl -s "$API_URL/api/v1/workflows/$WORKFLOW_ID")
  STATUS=$(echo "$WORKFLOW_STATUS" | jq -r '.status // .workflow.status // "UNKNOWN"')
  STAGE=$(echo "$WORKFLOW_STATUS" | jq -r '.currentStage // .workflow.currentStage // "N/A"')

  echo -e "${BLUE}Check $i/12:${NC} Status=${STATUS}, Stage=${STAGE}"

  if [ "$STATUS" = "COMPLETED" ]; then
    echo ""
    echo -e "${GREEN}✅ Workflow completed successfully!${NC}"
    echo ""
    echo "$WORKFLOW_STATUS" | jq '.'
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo ""
    echo -e "${RED}❌ Workflow failed${NC}"
    echo ""
    echo "$WORKFLOW_STATUS" | jq '.'
    break
  fi
done

# Step 4: Show results
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Test Summary                                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Task Created:${NC} $TASK_ID"
echo -e "${GREEN}✅ Workflow Started:${NC} $WORKFLOW_ID"
echo -e "${GREEN}✅ Final Status:${NC} $STATUS"
echo ""
echo -e "${BLUE}🔗 View workflow in Temporal UI:${NC}"
echo "   $TEMPORAL_UI/namespaces/default/workflows/$WORKFLOW_ID"
echo ""
echo -e "${BLUE}📋 View task:${NC}"
echo "   curl $API_URL/api/v1/tasks/$TASK_ID | jq '.'"
echo ""
echo -e "${BLUE}🔄 Check workflow status:${NC}"
echo "   curl $API_URL/api/v1/workflows/$WORKFLOW_ID | jq '.'"
echo ""
