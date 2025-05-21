#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- build.sh: STARTING SCRIPT ---"
echo "" # Blank line for readability in logs

echo "build.sh: Checking current directory:"
pwd
echo ""

echo "build.sh: Listing files in root:"
ls -A
echo ""

echo "build.sh: Listing files in js/ directory:"
ls -A js/
echo ""

echo "build.sh: Checking environment variables..."
echo "build.sh: FIREBASE_API_KEY is [${FIREBASE_API_KEY}]" # Will be redacted by Netlify log
echo "build.sh: FIREBASE_PROJECT_ID is [${FIREBASE_PROJECT_ID}]"
echo ""

TEMPLATE_FILE="js/script.template.js"
OUTPUT_FILE="js/script.js"

echo "build.sh: Checking for template file at ${TEMPLATE_FILE}..."
if [ ! -f "${TEMPLATE_FILE}" ]; then
    echo "build.sh: FATAL ERROR - Template file ${TEMPLATE_FILE} not found!"
    exit 1
fi
echo "build.sh: Template file found."
echo "build.sh: Contents of ${TEMPLATE_FILE} (first 25 lines):"
head -n 25 "${TEMPLATE_FILE}"
echo ""

echo "build.sh: --- RUNNING SED to create ${OUTPUT_FILE} ---"
sed \
  -e "s|__FIREBASE_API_KEY__|${FIREBASE_API_KEY}|g" \
  -e "s|__FIREBASE_AUTH_DOMAIN__|${FIREBASE_AUTH_DOMAIN}|g" \
  -e "s|__FIREBASE_PROJECT_ID__|${FIREBASE_PROJECT_ID}|g" \
  -e "s|__FIREBASE_STORAGE_BUCKET__|${FIREBASE_STORAGE_BUCKET}|g" \
  -e "s|__FIREBASE_MESSAGING_SENDER_ID__|${FIREBASE_MESSAGING_SENDER_ID}|g" \
  -e "s|__FIREBASE_APP_ID__|${FIREBASE_APP_ID}|g" \
  -e "s|__FIREBASE_MEASUREMENT_ID__|${FIREBASE_MEASUREMENT_ID}|g" \
  "${TEMPLATE_FILE}" > "${OUTPUT_FILE}"

# Check if sed command was successful (output file created and not empty)
if [ -s "${OUTPUT_FILE}" ]; then
  echo "build.sh: --- SED FINISHED SUCCESSFULLY ---"
else
  echo "build.sh: !!! SED COMMAND FAILED or output file ${OUTPUT_FILE} is empty !!!"
  exit 1
fi

echo "build.sh: Generated ${OUTPUT_FILE} (first 35 lines to check replacement):"
head -n 35 "${OUTPUT_FILE}"
echo ""

echo "build.sh: --- SCRIPT FINISHED SUCCESSFULLY ---"
