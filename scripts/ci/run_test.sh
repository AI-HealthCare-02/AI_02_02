set -eo pipefail

COLOR_GREEN=$(tput setaf 2)
COLOR_BLUE=$(tput setaf 4)
COLOR_RED=$(tput setaf 1)
COLOR_NC=$(tput sgr0)

cd "$(dirname "$0")/../.."

source .env

echo "${COLOR_BLUE}Find Tests${COLOR_NC}"

HAS_TESTS=false
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-ai-health-local}

if [ -d "./backend/tests" ] && find ./backend/tests -name 'test_*.py' -print -quit | read; then
  HAS_TESTS=true
fi

echo "Has tests: $HAS_TESTS"

if [ "$HAS_TESTS" = true ]; then
  if docker compose -p "${COMPOSE_PROJECT_NAME}" ps -q postgres >/dev/null 2>&1 \
    && [ -n "$(docker compose -p "${COMPOSE_PROJECT_NAME}" ps -q postgres)" ]; then
    echo "${COLOR_BLUE}PostgreSQL service found. Granting privileges...${COLOR_NC}"

    docker compose -p "${COMPOSE_PROJECT_NAME}" exec -T postgres \
      psql -U "${DB_USER}" -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

    echo "${COLOR_BLUE}Run Pytest with Coverage${COLOR_NC}"

    if ! uv run coverage run -m pytest backend; then
      echo ""
      echo "${COLOR_RED}Pytest failed.${COLOR_NC}"
      echo "${COLOR_RED}Fix the test failures above and re-run.${COLOR_NC}"
      exit 1
    fi

    echo "${COLOR_BLUE}Coverage Report${COLOR_NC}"
    if ! uv run coverage report -m; then
      echo "${COLOR_RED}Coverage check failed.${COLOR_NC}"
      exit 1
    fi
  else
    echo "${COLOR_RED}PostgreSQL service not found. Run docker compose -p ${COMPOSE_PROJECT_NAME} up postgres.${COLOR_NC}"
  fi
else
  echo "${COLOR_BLUE}No tests found. Skipping tests.${COLOR_NC}"
fi
