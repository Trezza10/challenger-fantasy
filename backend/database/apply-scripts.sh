#!/usr/bin/env bash
#
# Temporary PostgreSQL schema runner for the numbered SQL files in this folder.
#
# Usage:
#   CHALLENGER_DATABASE_URL='postgresql://user:password@localhost:5432/challenger_fantasy' \
#     ./backend/database/apply-scripts.sh
#
# Or:
#   ./backend/database/apply-scripts.sh \
#     'Host=localhost;Port=5432;Database=challenger_fantasy;Username=challenger;Password=...'
#
# The connection string is never printed. Files under database/tests are excluded.

set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
connection_string="${1:-${CHALLENGER_DATABASE_URL:-}}"

if [[ -z "$connection_string" ]]; then
  echo "Missing PostgreSQL connection string." >&2
  echo "Pass it as the first argument or set CHALLENGER_DATABASE_URL." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but was not found on PATH." >&2
  exit 127
fi

# Accept either a PostgreSQL URI or the .NET/Npgsql semicolon format used by the
# API configuration. psql/libpq does not understand keys such as "Host" or
# "Database", so translate them into explicit psql flags.
psql_connection_arguments=()
psql_password=""
if [[ "$connection_string" == *";"* ]]; then
  IFS=';' read -r -a connection_parts <<< "$connection_string"
  for connection_part in "${connection_parts[@]}"; do
    [[ -z "$connection_part" ]] && continue
    connection_key="${connection_part%%=*}"
    connection_value="${connection_part#*=}"
    normalized_key="$(printf '%s' "$connection_key" | tr '[:upper:]' '[:lower:]' | tr -d ' ')"

    case "$normalized_key" in
      host) psql_connection_arguments+=("--host=$connection_value") ;;
      port) psql_connection_arguments+=("--port=$connection_value") ;;
      database|initialcatalog) psql_connection_arguments+=("--dbname=$connection_value") ;;
      username|userid|user) psql_connection_arguments+=("--username=$connection_value") ;;
      password) psql_password="$connection_value" ;;
      *)
        echo "Unsupported .NET connection-string option: $connection_key" >&2
        echo "Use a postgresql:// URI if additional connection options are required." >&2
        exit 4
        ;;
    esac
  done
else
  # URI and native libpq connection strings can be consumed directly by psql.
  psql_connection_arguments+=("$connection_string")
fi

# Prefix each path with a zero-padded numeric key before sorting. This avoids the
# lexical ordering bug where 10_example.sql would otherwise run before 2_example.sql.
ordered_scripts=()
while IFS=$'\t' read -r _ script_path; do
  ordered_scripts+=("$script_path")
done < <(
  for script_path in "$script_directory"/[0-9]*_*.sql; do
    file_name="$(basename -- "$script_path")"
    numeric_prefix="${file_name%%_*}"
    if [[ "$numeric_prefix" =~ ^[0-9]+$ ]]; then
      printf '%012d\t%s\n' "$numeric_prefix" "$script_path"
    fi
  done | sort -n
)

if [[ ${#ordered_scripts[@]} -eq 0 ]]; then
  echo "No numbered SQL scripts found in $script_directory." >&2
  exit 3
fi

echo "Applying ${#ordered_scripts[@]} Challenger Fantasy database scripts..."

for script_path in "${ordered_scripts[@]}"; do
  echo "  -> $(basename -- "$script_path")"

  # ON_ERROR_STOP prevents psql from continuing after an error. Each file is one
  # transaction, so a failing script cannot be partially applied.
  PGPASSWORD="$psql_password" psql "${psql_connection_arguments[@]}" \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    --single-transaction \
    --file="$script_path"
done

echo "Database scripts applied successfully."
