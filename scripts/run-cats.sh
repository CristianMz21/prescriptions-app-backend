#!/bin/bash
set -e

echo "🚀 Starting Endava CATS API Fuzzing..."

# Ensure the output directory exists
mkdir -p cats-report

# Run the CATS Docker container.
# -v mounts the local cats-headers.yml to the container.
# -v mounts the output directory so the HTML reports are saved locally.
# --contract points to the local Swagger JSON definition (host.docker.internal resolves to the host's localhost).
# --server sets the base URL for the API requests.
# --headers points to the mounted headers file.
# --fuzzers=Validation,Security explicitly targets high-ROI fuzzers to aggressively test DTOs and RBAC, omitting slower boilerplate fuzzers.

docker run --rm -it \
  -v "$(pwd)/cats-headers.yml:/cats-headers.yml" \
  -v "$(pwd)/cats-report:/cats-report" \
  ghcr.io/endava/cats:latest \
  --contract=http://host.docker.internal:3000/docs-json \
  --server=http://host.docker.internal:3000 \
  --headers=/cats-headers.yml \
  --fuzzers=Validation,Security \
  --out=/cats-report

echo "✅ Fuzzing complete. Review the HTML report in the ./cats-report directory."
