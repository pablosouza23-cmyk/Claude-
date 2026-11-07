#!/usr/bin/env bash
# Builds and runs the engine-independent gameplay rule tests.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
CXX="${CXX:-g++}"
"$CXX" -std=c++17 -O1 -Wall -Wextra -Werror -I ../../Source/UltimateBattleRoyale RulesTests.cpp -o build/rules_tests
./build/rules_tests
"$CXX" -std=c++17 -O1 -Wall -Wextra -Werror -I ../../Source/UltimateBattleRoyale CrossCheck.cpp -o build/crosscheck
