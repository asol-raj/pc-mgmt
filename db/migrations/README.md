# Migrations

Baseline schema lives in `db/schema.sql`. Any schema change made *after* the app is
live goes here instead, as a numbered SQL file, applied in order:

```
0001_add_purchase_date.sql
0002_add_department_column.sql
```

Apply a migration with:

```
mysql -h <MYSQL_HOSTNAME> -P <MYSQL_PORT> -u <MYSQL_USERNAME> -p pcmgmt < db/migrations/0001_....sql
```

- `0001_add_os_edition_and_network.sql` — adds `os_edition`, `ip_address`, `ip_config`.
- `0002_add_last_reported_at.sql` — adds `last_reported_at`, set by the agent API.
- `0003_add_machine_id.sql` — adds the unique `machine_id` the agent API matches on.
