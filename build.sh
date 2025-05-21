#!/bin/bash
set -e

echo "--- build.sh: STARTING SCRIPT (v4) ---"
echo "Current directory: $(pwd)"
echo "FIREBASE_PROJECT_ID is [${FIREBASE_PROJECT_ID}]" # Check one non-sensitive var

TEMPLATE_FILE="js/script.template.js"
OUTPUT_FILE="js/script.js"
SED_SCRIPT_FILE="sed_commands.txt"

if [ ! -f "${TEMPLATE_FILE}" ]; then
    echo "FATAL ERROR - Template file ${TEMPLATE_FILE} not found!"
    exit 1
fi
echo "Template file found."

# Create the sed script file
# Using single quotes for the main sed script part helps prevent premature shell expansion
# The shell variables like ${FIREBASE_API_KEY} will be expanded by echo when writing to the file.
cat > "${SED_SCRIPT_FILE}" << EOF
s|__FIREBASE_API_KEY__|${FIREBASE_API_KEY}|g
s|__FIREBASE_AUTH_DOMAIN__|${FIREBASE_AUTH_DOMAIN}|g
s|__FIREBASE_PROJECT_ID__|${FIREBASE_PROJECT_ID}|g
s|__FIREBASE_STORAGE_BUCKET__|${FIREBASE_STORAGE_BUCKET}|g
s|__FIREBASE_MESSAGING_SENDER_ID__|${FIREBASE_MESSAGING_SENDER_ID}|g
s|__FIREBASE_APP_ID__|${FIREBASE_APP_ID}|g
s|__FIREBASE_MEASUREMENT_ID__|${FIREBASE_MEASUREMENT_ID}|g
EOF

echo "Generated sed script file (${SED_SCRIPT_FILE}):"
cat "${SED_SCRIPT_FILE}"
echo ""

echo "--- RUNNING SED with script file ---"
sed -f "${SED_SCRIPT_FILE}" "${TEMPLATE_FILE}" > "${OUTPUT_FILE}"

if [ -s "${OUTPUT_FILE}" ]; then
  echo "--- SED FINISHED SUCCESSFULLY (v4) ---"
else
  echo "!!! SED COMMAND FAILED or output file ${OUTPUT_FILE} is empty (v4) !!!"
  exit 1
fi

echo "Generated ${OUTPUT_FILE} (first 35 lines):"
head -n 35 "${OUTPUT_FILE}"
echo ""

echo "--- SCRIPT FINISHED SUCCESSFULLY (v4) ---"
