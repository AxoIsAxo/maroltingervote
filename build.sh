#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "--- build.sh: STARTING SCRIPT (v3) ---"
echo "build.sh: Checking current directory: $(pwd)"
echo "build.sh: Listing files in js/: $(ls -A js/)"
echo ""

# Assign environment variables to local shell variables
# This helps confirm they are being read and can sometimes help with complex expansions
V_API_KEY="${FIREBASE_API_KEY}"
V_AUTH_DOMAIN="${FIREBASE_AUTH_DOMAIN}"
V_PROJECT_ID="${FIREBASE_PROJECT_ID}"
V_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET}"
V_MESSAGING_SENDER_ID="${FIREBASE_MESSAGING_SENDER_ID}"
V_APP_ID="${FIREBASE_APP_ID}"
V_MEASUREMENT_ID="${FIREBASE_MEASUREMENT_ID}"

echo "build.sh: FIREBASE_API_KEY (from env) is [${V_API_KEY}]" # Will be redacted
echo "build.sh: FIREBASE_PROJECT_ID (from env) is [${V_PROJECT_ID}]"
echo ""

TEMPLATE_FILE="js/script.template.js"
OUTPUT_FILE="js/script.js"

if [ ! -f "${TEMPLATE_FILE}" ]; then
    echo "build.sh: FATAL ERROR - Template file ${TEMPLATE_FILE} not found!"
    exit 1
fi
echo "build.sh: Template file found."
echo "build.sh: Contents of ${TEMPLATE_FILE} (first 25 lines):"
head -n 25 "${TEMPLATE_FILE}"
echo ""

echo "build.sh: --- RUNNING SED to create ${OUTPUT_FILE} (using intermediate vars) ---"
sed \
  -e "s|__FIREBASE_API_KEY__|${V_API_KEY}|g" \
  -e "s|__FIREBASE_AUTH_DOMAIN__|${V_AUTH_DOMAIN}|g" \
  -e "s|__FIREBASE_PROJECT_ID__|${V_PROJECT_ID}|g" \
  -e "s|__FIREBASE_STORAGE_BUCKET__|${V_STORAGE_BUCKET}|g" \
  -e "s|__FIREBASE_MESSAGING_SENDER_ID__|${V_MESSAGING_SENDER_ID}|g" \
  -e "s|__FIREBASE_APP_ID__|${V_APP_ID}|g" \
  -e "s|__FIREBASE_MEASUREMENT_ID__|${V_MEASUREMENT_ID}|g" \
  "${TEMPLATE_FILE}" > "${OUTPUT_FILE}"

if [ -s "${OUTPUT_FILE}" ]; then
  echo "build.sh: --- SED FINISHED SUCCESSFULLY (v3) ---"
else
  echo "build.sh: !!! SED COMMAND FAILED or output file ${OUTPUT_FILE} is empty (v3) !!!"
  exit 1
fi

echo "build.sh: Generated ${OUTPUT_FILE} (first 35 lines to check replacement):"
head -n 35 "${OUTPUT_FILE}"
echo ""

echo "build.sh: --- SCRIPT FINISHED SUCCESSFULLY (v3) ---"
