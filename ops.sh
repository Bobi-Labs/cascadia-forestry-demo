#!/usr/bin/env bash
# ops.sh — project CLI
#
# Single entry point for all project operations: build, run, test, deploy.
# Both humans and AI agents use this as the "how do I do anything" reference.
#
# Usage: ./ops.sh <command> [args]

set -euo pipefail

# ──────────────── Config ────────────────

PROJECT_NAME="cascadia-forestry-demo"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ──────────────── Helpers ────────────────

die() { echo "Error: $*" >&2; exit 1; }

# ──────────────── Commands ────────────────

cmd="${1:-help}"
shift || true

# ─── install ──────────────────────────────────────────

if [[ "$cmd" == "install" ]]; then

    echo "Installing dependencies..."
    cd "$PROJECT_DIR"
    pnpm install "$@"

# ─── dev ──────────────────────────────────────────────

elif [[ "$cmd" == "dev" ]]; then

    echo "Starting Next.js dev server..."
    cd "$PROJECT_DIR"
    pnpm dev "$@"

# ─── build ────────────────────────────────────────────

elif [[ "$cmd" == "build" ]]; then

    echo "Building $PROJECT_NAME..."
    cd "$PROJECT_DIR"
    pnpm build

# ─── start ────────────────────────────────────────────

elif [[ "$cmd" == "start" ]]; then

    echo "Starting production server..."
    cd "$PROJECT_DIR"
    pnpm start "$@"

# ─── lint ─────────────────────────────────────────────

elif [[ "$cmd" == "lint" ]]; then

    echo "Running ESLint..."
    cd "$PROJECT_DIR"
    pnpm lint "$@"

# ─── typecheck ────────────────────────────────────────

elif [[ "$cmd" == "typecheck" ]]; then

    echo "Running TypeScript type check..."
    cd "$PROJECT_DIR"
    pnpm exec tsc --noEmit "$@"

# ─── check ────────────────────────────────────────────

elif [[ "$cmd" == "check" ]]; then

    echo "Running lint + typecheck..."
    cd "$PROJECT_DIR"
    echo "── Lint ──"
    pnpm lint
    echo ""
    echo "── TypeCheck ──"
    pnpm exec tsc --noEmit
    echo ""
    echo "All checks passed."

# ─── deploy ───────────────────────────────────────────

elif [[ "$cmd" == "deploy" ]]; then

    TARGET="${1:-preview}"
    cd "$PROJECT_DIR"

    if [[ "$TARGET" == "prod" || "$TARGET" == "production" ]]; then
        echo "Deploying $PROJECT_NAME to production..."
        vercel --prod
    else
        echo "Deploying $PROJECT_NAME preview..."
        vercel
    fi

# ─── env-pull ─────────────────────────────────────────

elif [[ "$cmd" == "env-pull" ]]; then

    ENV="${1:-development}"
    echo "Pulling environment variables ($ENV)..."
    cd "$PROJECT_DIR"
    vercel env pull .env.local --environment "$ENV"

# ─── logs ─────────────────────────────────────────────

elif [[ "$cmd" == "logs" ]]; then

    echo "Tailing Vercel logs..."
    cd "$PROJECT_DIR"
    # If no args given, stream live production logs; otherwise pass args through
    if [[ $# -eq 0 ]]; then
        vercel logs --follow --environment production
    else
        vercel logs "$@"
    fi

# ─── status ───────────────────────────────────────────

elif [[ "$cmd" == "status" ]]; then

    cd "$PROJECT_DIR"
    echo "── Git ──"
    git status --short
    echo ""
    echo "── Recent Deployments ──"
    vercel list --limit 5 2>/dev/null || echo "(vercel CLI not available)"

# ─── test ─────────────────────────────────────────────

elif [[ "$cmd" == "test" ]]; then

    echo "Running tests..."
    cd "$PROJECT_DIR"
    pnpm exec vitest run "$@"

# ─── e2e ──────────────────────────────────────────────

elif [[ "$cmd" == "e2e" ]]; then

    echo "Running E2E tests (requires production build)..."
    cd "$PROJECT_DIR"
    pnpm exec playwright test "$@"

# ─── gen-types ────────────────────────────────────────

elif [[ "$cmd" == "gen-types" ]]; then

    cd "$PROJECT_DIR"
    # Load env vars if .env.local exists
    if [[ -f .env.local ]]; then
        set -a; source .env.local; set +a
    fi
    # Extract project ID from SUPABASE_URL (the subdomain)
    PROJECT_REF="${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL not set}"
    PROJECT_REF="${PROJECT_REF#https://}"
    PROJECT_REF="${PROJECT_REF%%.*}"
    echo "Generating Supabase database types for project: $PROJECT_REF..."
    npx supabase gen types typescript --project-id "$PROJECT_REF" > lib/supabase/database.types.ts
    echo "Written to lib/supabase/database.types.ts"

# ─── clean ────────────────────────────────────────────

elif [[ "$cmd" == "clean" ]]; then

    echo "Cleaning build artifacts..."
    cd "$PROJECT_DIR"
    rm -rf .next out
    echo "Removed .next/ and out/"

    if [[ "${1:-}" == "--all" ]]; then
        rm -rf node_modules
        echo "Removed node_modules/"
    fi

# ─── docs ─────────────────────────────────────────────

elif [[ "$cmd" == "docs" ]]; then

    cd "$PROJECT_DIR/docs"
    if command -v open &>/dev/null; then
        open .
    else
        echo "Docs directory: $PROJECT_DIR/docs"
        ls -1
    fi

# ─── help ─────────────────────────────────────────────

elif [[ "$cmd" == "help" ]]; then

    cat << 'EOF'
Usage: ./ops.sh COMMAND [args]

Development:
  dev                    Start Next.js dev server (localhost:3000)
  build                  Build for production
  start                  Start production server locally
  install                Install dependencies (pnpm install)

Quality:
  lint                   Run ESLint
  typecheck              Run TypeScript type checker
  check                  Run lint + typecheck
  test                   Run vitest unit tests
  e2e                    Run Playwright E2E tests (builds + starts server)

Deploy & manage:
  deploy [prod]          Deploy to Vercel (default: preview)
  env-pull [env]         Pull env vars from Vercel (default: development)
  logs [url|opts]        Tail Vercel logs (default: live production stream)
  status                 Show git status + recent deployments

Supabase:
  gen-types              Regenerate DB types (lib/supabase/database.types.ts)

Utilities:
  clean [--all]          Remove .next/ and out/ (--all: also node_modules/)
  docs                   Open docs/ directory

Examples:
  ./ops.sh dev
  ./ops.sh build
  ./ops.sh check
  ./ops.sh deploy prod
  ./ops.sh gen-types
  ./ops.sh env-pull production
  ./ops.sh clean --all && ./ops.sh install

EOF

else
    die "Unknown command: $cmd (try: ./ops.sh help)"
fi
