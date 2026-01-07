# Agile Module Test Checklist

Use this checklist to verify the new Agile module, module access, and RLS paths.

## Access levels
- RW user: Agile visible in nav/dashboard; can create issues, drag between columns, edit estimates, change roadmap bucket, delete.
- RO user: Agile visible; no quick add, drag is disabled, estimate/bucket controls disabled; data loads without errors.
- No Access: Agile hidden from nav; direct navigation redirects to dashboard or shows access blocked message.
- Admin: bypass RLS, full CRUD on statuses/buckets/issues.

## Board
- Load board: statuses appear with counts and point totals.
- Drag issue between statuses (RW): ordering updates persist after refresh.
- Filters active: drag is disabled and banner text explains why.
- Delete issue (RW): card removed and stays removed after refresh.

## Backlog
- List renders all filtered issues; estimate edits persist.
- Tags render as chips; unassigned renders as “Unassigned”.

## Roadmap
- Buckets show issues grouped by bucket.
- Changing bucket (RW) moves issue; RO cannot change.

## Analytics
- Story points and progress bar update as estimates and statuses change.

## RLS smoke
- Supabase REST calls succeed for RW/RO; No Access returns 401/permission denied.
- Policies block writes for RO/No Access on `agile_*` tables.

