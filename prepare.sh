#!/bin/bash

# Pretty colors
RESET='\033[0m'
ERR='\033[0;31m'
WARN='\033[0;33m'
DONE='\033[0;32m'
INFO='\033[0;34m'

echo -e "\nprepare.sh: Preparing workspace"

# Autofill recommended workspace VS Code settings - you can then modify them freely inside .vscode/settings.json
VSCODE_PATH="./.vscode"
VSCODE_SETTINGS_TEMPLATE="${VSCODE_PATH}/settings-template.json"
VSCODE_SETTINGS="${VSCODE_PATH}/settings.json"

if ! test -f "${VSCODE_SETTINGS}"; then
	echo -en "\nprepare.sh: ${INFO}Copying VS Code template settings${RESET} into ${VSCODE_SETTINGS}... "
	cp "${VSCODE_SETTINGS_TEMPLATE}" "${VSCODE_SETTINGS}"
	echo "✅"
else
	echo -e "\nprepare.sh: ${INFO}VS Code workspace settings found${RESET} - skipped overwriting them (see ${VSCODE_SETTINGS_TEMPLATE})"
fi

if ! command -v python >/dev/null 2>&1; then
	echo -e "\nprepare.sh: ${ERR}Failed${RESET} - you must install a python executable as we use it to run pre-commit hooks"
	exit 1
fi

echo -e "\nprepare.sh: ${INFO}Installing git hooks${RESET} using pre-commit... "
python ./.tools/pre-commit-2.17.0.pyz install
python ./.tools/pre-commit-2.17.0.pyz install --hook-type commit-msg

echo -e "\nprepare.sh: ${DONE}Workspace prepared successfully${RESET}\n"
