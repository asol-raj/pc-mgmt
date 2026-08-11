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

No migrations yet.
