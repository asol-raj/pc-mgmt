# PC Agent API

The endpoint the .NET agent app installed on each PC uses to report that machine's
details into the register. It authenticates with an API key, not the admin session
cookie, so no login is involved.

## Endpoint

```
POST /api/agent/report
GET  /api/agent/report      (key check — returns { "ok": true })
```

Both require the key. Send it either way:

```
X-API-Key: <key>
Authorization: Bearer <key>
```

The key lives in `.env` as `AGENT_API_KEY`. To rotate it without breaking machines
still running the old build, list both keys while the rollout happens:

```
AGENT_API_KEY=new_key_here,old_key_here
```

If `AGENT_API_KEY` is unset the endpoint rejects everything — it never falls open.

## What the agent sends

`Content-Type: application/json`. Every field is optional except that each report
must identify its machine by **`machine_id`**, **`asset_tag`**, or **`name`** (the
Windows host name).

| Field | Type | Notes |
|---|---|---|
| `machine_id` / `machine_guid` | string (≤100) | **Strongly recommended.** Stable per-machine id — see below. |
| `asset_tag` | string (≤50) | Fallback identifier. If the app knows the tag, send it too. |
| `name` / `host_name` | string (≤100) | Windows host name. Fallback identifier, and the display name when the PC is first registered. |
| `brand` | string (≤50) | e.g. `Dell Inc.` |
| `machine_type` | enum | `Desktop` \| `Laptop` \| `AIO` |
| `cpu` | string (≤100) | |
| `ram_gb` | number | 0–65535 |
| `storage_type` | enum | `SSD` \| `HDD` |
| `storage_capacity` | string (≤20) | e.g. `512GB` |
| `os` | enum | `Windows 10` \| `Windows 11` |
| `os_edition` | enum | `Home` \| `Pro` \| `Enterprise` \| `Education` |
| `ip_address` | string | IPv4 or IPv6 |
| `ip_config` | enum | `Static` \| `Dynamic` |
| `teamviewer_id` | string (≤50) | |
| `softwares` | string (≤4000) | Comma-separated list of installed software |
| `location` | string (≤150) | **Only used when the PC is new** — see below |
| `assigned_users` | string (≤255) | **Only used when the PC is new** |
| `systeminfo` | string | Raw stdout of the Windows `systeminfo` command — see below |

### Shortcut: post the raw `systeminfo` output

Instead of filling in the fields, the app can shell out to `systeminfo` and post its
stdout as `systeminfo`. The server parses out host name, brand, CPU, RAM, Windows
version, Windows edition, IP address, and Static/Dynamic (from `DHCP Enabled`).

Any field you also send explicitly wins over the parsed value, so mixing is fine —
e.g. post `systeminfo` plus your own `asset_tag` and `teamviewer_id`.

## `machine_id` — how duplicates are prevented

Send a value that is stable for the life of the machine and unique across the office.
Good choices, in order of preference:

```csharp
// 1. Windows MachineGuid — survives renames, hardware changes, and app reinstalls
using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
var machineId = (string?)key?.GetValue("MachineGuid");

// 2. Hardware UUID, if you prefer to tie the id to the box itself
// (wmic csproduct get uuid  /  Win32_ComputerSystemProduct.UUID)
```

The column is `UNIQUE` in the database, so a second row for the same machine is
impossible even if two reports arrive at the same instant.

Why it matters: the admin renames PCs in the dashboard — `DESKTOP-AB12CD3` becomes
`Accounts Desk 3`, and its tag becomes `PC-042`. An agent reporting only its host name
would then match nothing and register the machine a second time. With `machine_id` the
row is found regardless of what it has been renamed to.

If the app has already been rolled out without one, adding it later is safe: the first
report that carries a `machine_id` links it to the row matched by tag or host name, and
every report after that matches on the id.

## Preventing new rows entirely

Once every PC is in the register, set this in `.env` and restart:

```
AGENT_ALLOW_CREATE=false
```

The agent can then only update PCs that already exist; a machine that is not in the
register gets `409` and an admin has to add it by hand. Leave it `true` (the default)
during the initial rollout.

## What a report can and cannot change

A report **overwrites** the machine-detected fields listed above on every call.

A report **never touches** the fields the office admin curates in the dashboard:
`name`, `location`, `extension_number`, `status`, `performance`, `condition_status`,
`assigned_users`, `comments`, and `asset_tag`. Sending them on a report for an
existing PC is harmless — they are ignored. (`name`, `location` and `assigned_users`
are used only when the PC is being created for the first time, so an admin renaming
a PC to a friendly name is never undone by the next report.)

Fields that have not changed are not written at all: an unchanged report answers
`{"status":"unchanged","updated_fields":[]}` and only bumps `last_reported_at`.

## Creating vs updating

The machine is matched in this order:

1. `machine_id` matches an existing PC → that row is updated. Always wins.
2. Otherwise `asset_tag` matches an existing PC → that row is updated, and the
   reported `machine_id` is stored on it so future reports match at step 1.
   If that row already belongs to a *different* `machine_id`, the call returns `409`
   rather than overwriting one machine's record with another's.
3. Otherwise `name` matches exactly one PC → same as step 2. (A name match on a row
   owned by another `machine_id` is skipped — that is just two PCs sharing a display
   name, so this machine gets its own row.)
4. Otherwise a new PC is registered, with:
   - `asset_tag` = the tag sent, or the host name if none was sent
   - `location` = the location sent, or `Unassigned`
   - status `Active`, condition `New`, performance `Good` (admin adjusts later)
   - `os` is **required** here — a brand-new row cannot be created without it
   - blocked entirely if `AGENT_ALLOW_CREATE=false`

If two PCs already share the reported host name, the call returns `409` and asks for a
`machine_id` or `asset_tag`, rather than guessing which machine reported.

Every accepted report stamps `last_reported_at`, shown as **Last Agent Report** in
the admin dashboard, so a machine that stopped checking in is easy to spot.

## Responses

| Status | Body | Meaning |
|---|---|---|
| `200` | `{"status":"updated","id":1,"asset_tag":"PC-001","updated_fields":[...]}` | Existing PC updated |
| `200` | `{"status":"unchanged","id":1,"asset_tag":"PC-001","updated_fields":[]}` | Nothing differed; only `last_reported_at` moved |
| `201` | `{"status":"created","id":11,"asset_tag":"DESKTOP-AB12","updated_fields":[...]}` | New PC registered |
| `400` | `{"error":"os must be one of Windows 10, Windows 11"}` | Bad or missing field |
| `401` | `{"error":"Invalid or missing API key"}` | Key wrong or absent |
| `409` | `{"error":"More than one PC is named ..."}` | Ambiguous host name |
| `409` | `{"error":"asset_tag ... already registered to a different machine"}` | Two machines claim one tag — an admin fixes the tag |
| `409` | `{"error":"... AGENT_ALLOW_CREATE is off ..."}` | Unknown machine while creation is locked down |
| `500` | `{"error":"Failed to store the report"}` | Database error |

Reports are idempotent — the agent can safely run on a schedule (say hourly, or at
login) and re-send the same values.

## Examples

curl:

```sh
curl -X POST http://<server>:7100/api/agent/report \
  -H "X-API-Key: $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "machine_id": "9d6f2a13-4c8e-4f0b-9a77-2b1c5d3e6f80",
        "asset_tag": "PC-001",
        "name": "DESKTOP-AB12CD3",
        "brand": "Dell Inc.",
        "machine_type": "Desktop",
        "cpu": "Intel i5-12400",
        "ram_gb": 8,
        "storage_type": "SSD",
        "storage_capacity": "512GB",
        "os": "Windows 11",
        "os_edition": "Pro",
        "ip_address": "192.168.1.57",
        "ip_config": "Static",
        "teamviewer_id": "123 456 789"
      }'
```

C# (.NET agent), structured payload:

```csharp
using System.Net.Http.Json;

var http = new HttpClient { BaseAddress = new Uri("http://<server>:7100/") };
http.DefaultRequestHeaders.Add("X-API-Key", apiKey);

var payload = new
{
    machine_id = machineGuid,             // stable id — keeps reports on one row forever
    asset_tag = assetTag,                 // null/omitted is fine — host name is the fallback
    name = Environment.MachineName,
    brand = manufacturer,
    machine_type = "Desktop",
    cpu = cpuName,
    ram_gb = ramGb,
    storage_type = "SSD",
    storage_capacity = "512GB",
    os = "Windows 11",
    os_edition = "Pro",
    ip_address = ipAddress,
    ip_config = dhcpEnabled ? "Dynamic" : "Static",
    teamviewer_id = teamViewerId
};

var response = await http.PostAsJsonAsync("api/agent/report", payload);
response.EnsureSuccessStatusCode();
```

C#, the `systeminfo` shortcut:

```csharp
var psi = new ProcessStartInfo("systeminfo") { RedirectStandardOutput = true, CreateNoWindow = true };
using var proc = Process.Start(psi)!;
var output = await proc.StandardOutput.ReadToEndAsync();
await proc.WaitForExitAsync();

var response = await http.PostAsJsonAsync("api/agent/report", new
{
    machine_id = machineGuid,
    asset_tag = assetTag,
    teamviewer_id = teamViewerId,
    systeminfo = output
});
```

## Deployment notes

- Keep the key out of the installer's plain-text config if you can — a machine-scoped
  registry value or DPAPI-protected setting is better than an `appsettings.json` next
  to the exe. Anyone holding the key can write to the register.
- The endpoint is HTTP on the office LAN. If reports ever cross an untrusted network,
  put it behind HTTPS — the key is sent in a header in clear text otherwise.
- The API key grants write access to PC records only. It cannot read the admin
  dashboard, delete PCs, or change admin-curated fields.
