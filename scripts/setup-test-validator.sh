#!/usr/bin/env bash

set -ex

SCRIPTS_DIR=$(dirname "${BASH_SOURCE[0]}")
TARGET_DIR=$( cd "$SCRIPTS_DIR/.." ; pwd -P )/.Genixor

# setup environment
version=$(bash $SCRIPTS_DIR/get-latest-validator-release-version.sh)
sh -c "$(curl -sSfL https://release.Genixor.com/$version/install)" init $version --data-dir $TARGET_DIR --no-modify-path
$TARGET_DIR/active_release/bin/Genixor --version
