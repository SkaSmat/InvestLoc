#!/usr/bin/env bash
# deploy.sh — déploiement complet InvestLoc sur Supabase
# Usage : bash scripts/deploy.sh

set -e

PROJECT_REF="wtqtmezvzlsrahqfedah"

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Erreur : ANTHROPIC_API_KEY non définie."
  echo "  export ANTHROPIC_API_KEY=sk-ant-..."
  exit 1
fi

echo "==> Linking project..."
supabase link --project-ref "$PROJECT_REF"

echo "==> Applying DB migrations..."
supabase db push

echo "==> Setting Anthropic secret..."
supabase secrets set ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"

echo "==> Deploying Edge Functions..."
supabase functions deploy agent-supervisor
supabase functions deploy extract-listing
supabase functions deploy score-quartier
supabase functions deploy chat-analysis
supabase functions deploy daily-scraper

echo ""
echo "✓ Déploiement terminé !"
echo "  Dashboard : https://supabase.com/dashboard/project/$PROJECT_REF/functions"
