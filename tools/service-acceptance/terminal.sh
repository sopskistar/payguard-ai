#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /home/sopski/payguard-ai
trap 'printf "\nRunner ended. Press Enter to close this terminal.\n"; read -r terminal_close' EXIT
# The transcript contains public transaction terms and explicit typed confirmations.
# The key is read from its private file by Node and is never typed or printed.
acceptance_expected_sha="$(git rev-parse HEAD)"
script -q -e -f -c "node --conditions=react-server --import tsx tools/service-acceptance/run.ts --execute --expected-sha ${acceptance_expected_sha}" .data/terminal-sdk-session.log
