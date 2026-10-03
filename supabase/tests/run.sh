#!/usr/bin/env bash
# Runs every SQL test suite against a local Postgres, each in a fresh database.
# Usage: PSQL="psql -h /path/to/socket -p 5499 -U postgres" supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-psql}
M=migrations
T=tests

fresh() {
  $PSQL -q -d postgres -c "drop database if exists hubtest" -c "create database hubtest" >/dev/null
}
run() { # files...
  for f in "$@"; do $PSQL -q -v ON_ERROR_STOP=1 -d hubtest -f "$f" >/dev/null; done
}
users() {
  $PSQL -q -v ON_ERROR_STOP=1 -d hubtest >/dev/null <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001','max@x.com','{"full_name":"Max"}'),
 ('aaaaaaaa-0000-0000-0000-000000000002','pat@x.com','{"full_name":"Pat"}'),
 ('aaaaaaaa-0000-0000-0000-000000000003','quinn@x.com','{"full_name":"Quinn"}');
SQL
}

fresh; run $T/supabase_stub.sql $M/0001_profiles_and_roles.sql $T/0001_profiles.test.sql; echo "ok 0001"
fresh; run $T/supabase_stub.sql $M/0001_profiles_and_roles.sql; users
       run $M/0002_content_workflow.sql $T/0002_content_workflow.test.sql; echo "ok 0002"
fresh; run $T/supabase_stub.sql $M/0001_profiles_and_roles.sql; users
       run $M/0002_content_workflow.sql $M/0003_delete_own_account.sql $T/0003_delete_own_account.test.sql; echo "ok 0003"
fresh; run $T/supabase_stub.sql $M/0001_profiles_and_roles.sql; users
       run $M/0002_content_workflow.sql $M/0003_delete_own_account.sql $M/0004_article_teams.sql $T/0004_article_teams.test.sql; echo "ok 0004"
fresh; run $T/supabase_stub.sql $M/0001_profiles_and_roles.sql; users
       run $M/0002_content_workflow.sql $M/0003_delete_own_account.sql $M/0004_article_teams.sql \
           $M/0005_scope_corrections.sql $T/0005_scope_corrections.test.sql; echo "ok 0005"
