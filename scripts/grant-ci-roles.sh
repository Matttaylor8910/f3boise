#!/usr/bin/env bash
# Grants the GitHub Actions deploy service account every project role the
# workflows in .github/workflows need. Run once as a project owner:
#
#   gcloud auth login
#   ./scripts/grant-ci-roles.sh
#
# Safe to re-run; add-iam-policy-binding is idempotent.
set -euo pipefail

PROJECT=f3-boise
SA="serviceAccount:github-action-566584330@${PROJECT}.iam.gserviceaccount.com"

ROLES=(
  roles/firebaserules.admin                # firebase-firestore-rules.yml: upload rules
  roles/serviceusage.serviceUsageConsumer  # rules + functions: CLI checks APIs are enabled
  roles/cloudfunctions.developer           # firebase-functions-merge.yml: create/update functions
  roles/iam.serviceAccountUser             # functions run as the App Engine default account
  roles/artifactregistry.writer            # CLI cleans up old function build images
)

for role in "${ROLES[@]}"; do
  echo "== ${role}"
  gcloud projects add-iam-policy-binding "${PROJECT}" \
    --member="${SA}" --role="${role}" --condition=None --quiet >/dev/null
done

echo
echo "Done. Re-run the failed workflows from the Actions tab, or:"
echo "  gh workflow run 'Deploy Firestore rules'"
echo "  gh workflow run 'Deploy Cloud Functions on merge'"
