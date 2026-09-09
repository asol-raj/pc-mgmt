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
| `name` / `host_name` | string (≤100) | Windows host name, e.g. `POS-101`. Both a fallback identifier and a detected field — the register follows renames made in Windows. |
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
| `softwares` | string (≤4000) | Comma-separated list of installed software names. Kept for older builds; new builds send `software` as well |
| `software` | array | Installed programs, one object each — see below |
| `printers` | array | Installed printers, one object each — see below |
| `location` | string (≤150) | **Only used when the PC is new** — the agent does not send it |
| `assigned_users` | string (≤255) | Comma-separated local Windows accounts that can sign in, e.g. `cfc, jatin, raj` |
| `audio_output` | enum | `Working` \| `Disabled` \| `Faulty` \| `None` — see below |
| `microphone` | enum | `Working` \| `Disabled` \| `Faulty` \| `None` — see below |
| `camera` | enum | `Working` \| `Disabled` \| `Faulty` \| `None` — see below |
| `systeminfo` | string | Raw stdout of the Windows `systeminfo` command — see below |

### Shortcut: post the raw `systeminfo` output

Instead of filling in the fields, the app can shell out to `systeminfo` and post its
stdout as `systeminfo`. The server parses out host name, brand, CPU, RAM, Windows
version, Windows edition, IP address, and Static/Dynamic (from `DHCP Enabled`).

Any field you also send explicitly wins over the parsed value, so mixing is fine —
e.g. post `systeminfo` plus your own `asset_tag` and `teamviewer_id`.

## Multimedia hardware — `audio_output`, `microphone`, `camera`

Each answers "does this PC have working audio / mic / camera hardware", which is a
health state rather than a yes/no:

| Value | Meaning |
|---|---|
| `Working` | Present, and Windows reports no problem with it |
| `Disabled` | Present, but switched off — Device Manager problem code `22` |
| `Faulty` | Present, but Windows reports a driver or device problem |
| `None` | Checked, and the machine has no such device |

Omitting a field leaves the column `NULL`, which means *never reported* — an older
agent build, or a PC an admin added by hand. That is deliberately distinct from
`None`, which is a positive statement that the machine was checked.

**`audio_output` does not mean a speaker is plugged in.** Windows cannot tell whether
anything is connected to the analog jack on a desktop tower, so no software can report
that. `Working` means the audio hardware is present and healthy, which is the thing
that is actually actionable — a disabled or broken sound device is a fault to fix, an
unplugged speaker is not something the register can see.

## Installed programs and printers — `software`, `printers`

Both are the *whole* list as of that report. The register stores each in its own
table (`pc_software`, `pc_printers`) and replaces the PC's rows outright every time
the key is present, so the dashboard's **View** grid always shows what the machine
last said. Two things follow:

- **Omit the key** to leave the stored list alone (an older agent build that never
  sends it does exactly this).
- **Send an empty array** to say "nothing installed" — the stored rows are removed.

The register compares the incoming list with what it holds and writes nothing when
they match; a changed list appears as `software` / `printers` in `updated_fields`.

```json
"software": [
  { "name": "Google Chrome", "version": "128.0.6613.120", "publisher": "Google LLC", "install_date": "2025-03-14" },
  { "name": "RETAILvantage Client", "version": "3.2.1", "publisher": null, "install_date": null }
],
"printers": [
  { "name": "HP LaserJet Pro M404", "driver": "HP Universal Printing PCL 6", "port": "192.168.0.50", "kind": "Network", "is_default": true, "status": "Ready" },
  { "name": "Microsoft Print to PDF", "driver": "Microsoft Print To PDF", "port": "PORTPROMPT:", "kind": "Virtual", "is_default": false, "status": "Ready" }
]
```

| Field | Type | Notes |
|---|---|---|
| `software[].name` | string (≤200) | Required per entry; an entry without one is skipped. Longer values are cut, not refused. |
| `software[].version` | string (≤100) | |
| `software[].publisher` | string (≤200) | |
| `software[].install_date` | `YYYY-MM-DD` | Anything else is stored as null — most installers never write a date |
| `printers[].name` | string (≤200) | Required per entry |
| `printers[].driver` | string (≤200) | |
| `printers[].port` | string (≤200) | `USB001`, an IP port name, a share path, or a pseudo-port such as `PORTPROMPT:` |
| `printers[].kind` | enum | `Local` \| `Network` \| `Virtual` (Print to PDF, XPS, OneNote, fax). Defaults to `Local` |
| `printers[].is_default` | boolean | The Windows default printer |
| `printers[].status` | string (≤50) | `Ready`, `Offline`, `Error`, `Paper Out`, … as the spooler last reported |

Limits: at most 2000 program entries and 200 printer entries per report; more is
refused with `400`. Fetch what is stored with `GET /api/pcs/<id>/software` and
`GET /api/pcs/<id>/printers` (no key needed — they are public like `GET /api/pcs`).

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

Why it matters: a PC gets renamed — in Windows to match a desk extension, or its
`asset_tag` changed in the dashboard. An agent reporting only its old host name would
then match nothing and register the machine a second time. With `machine_id` the row
is found regardless of what the machine or the admin has renamed.

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

A report **overwrites** the machine-detected fields listed above on every call, and
replaces the `software` and `printers` lists whenever it carries them.

That includes `name` and `assigned_users`. These offices rename PCs in Windows to
match desk extension numbers, and local accounts are created and removed as staff
change, so both need to track the machine the same way `ip_address` does. A rename
still cannot produce a duplicate row, because matching runs on `machine_id` first.

A report **never touches** the fields the office admin curates in the dashboard:
`asset_tag`, `location`, `extension_number`, `status`, `performance`,
`condition_status`, and `comments`. Sending them on a report for an existing PC is
harmless — they are ignored. `asset_tag` in particular is the one stable human label
the admin owns, and no report ever writes it.

`location` is the exception that is read at creation time only (defaulting to
`Unassigned`), since the agent does not report it at all.

Fields that have not changed are not written at all: an unchanged report answers
`{"status":"unchanged","updated_fields":[]}` and only bumps `last_reported_at`. A
changed `name` or `assigned_users` shows up in `updated_fields` like any other
detected field.

## Creating vs updating

The machine is matched in this order:

1. `machine_id` matches an existing PC → that row is updated. Always wins.
2. Otherwise `asset_tag` matches an existing PC → that row is updated, and the
   reported `machine_id` is stored on it so future reports match at step 1.
   If that row already belongs to a *different* `machine_id`, the call returns `409`
   rather than overwriting one machine's record with another's.
3. Otherwise `name` matches exactly one PC → same as step 2. (A name match on a row
   owned by another `machine_id` is skipped — that is just two PCs sharing a host
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
