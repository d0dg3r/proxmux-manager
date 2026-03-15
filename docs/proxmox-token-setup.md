# Proxmox API Token Setup

This guide helps you create a Proxmox API token that works reliably with PROXMUX Manager for:

- resource discovery (nodes, VMs, LXCs),
- console actions,
- power operations,
- host status and metadata.

If your token is missing required audit rights, PROXMUX may show only node data and miss VMs/LXCs.

## Required Access (minimum functional baseline)

At minimum, your token/user needs:

- `Sys.Audit` (cluster/node visibility),
- VM/LXC audit scope (`VM.Audit`) for resource listing,
- console/power rights based on your usage (`VM.Console`, lifecycle actions).

For a straightforward full-access setup, this guide uses `Administrator` at `/`.

## Method A (Recommended): Dedicated API User

Use a dedicated API user and assign explicit cluster ACLs.

### 1) Create API user

```bash
pveum user add api-admin@pve --password 'CHANGE_ME_STRONG_PASSWORD'
```

### 2) Assign full cluster role

```bash
pveum acl modify / --user api-admin@pve --role Administrator
```

### 3) Create token

```bash
pveum user token add api-admin@pve full-access --privsep 0
```

`--privsep 0` disables separated token privileges and makes the token inherit the user's effective ACLs.

## Method B (Fallback): Token for `root@pam`

Use only if you explicitly accept higher risk.

```bash
pveum user token add root@pam mein-token --privsep 0
```

## zsh-safe Curl Usage

In `zsh`, always wrap Authorization header and URL in single quotes (`'...'`) to avoid issues with `!`, `?`, and shell expansion.

## Token Secret Handling (Important)

- The token secret is shown by Proxmox only once.
- The helper script writes a uniquely named token record file with restrictive permissions (`600`), for example:
  - `proxmox-token-<user>-<tokenid>-<host>-<timestamp>.txt`
- The script asks whether to write the file to disk. Recommended default is `Yes`.
- Import the secret into your password manager immediately.
- After successful password manager import, delete the local file.

Secure deletion options:

```bash
# Preferred when available
shred -u '/path/to/proxmox-token-...txt'

# Fallback
rm '/path/to/proxmox-token-...txt'
```

## Validation Commands

Replace placeholders:

- `YOUR_HOST` (for example `10.0.0.10` or `pve01.example.local`)
- `USER_REALM` (for example `api-admin@pve`)
- `TOKEN_ID` (for example `full-access`)
- `TOKEN_SECRET` (token value from `pveum`)

### List resources (should return nodes/VMs/LXCs)

```bash
curl -k -s -H 'Authorization: PVEAPIToken=USER_REALM!TOKEN_ID=TOKEN_SECRET' \
  'https://YOUR_HOST:8006/api2/json/cluster/resources'
```

### Start VM 100

```bash
curl -k -X POST -H 'Authorization: PVEAPIToken=USER_REALM!TOKEN_ID=TOKEN_SECRET' \
  'https://YOUR_HOST:8006/api2/json/nodes/pve-node-name/qemu/100/status/start'
```

### Node status (host metrics)

```bash
curl -k -s -H 'Authorization: PVEAPIToken=USER_REALM!TOKEN_ID=TOKEN_SECRET' \
  'https://YOUR_HOST:8006/api2/json/nodes/pve-node-name/status'
```

## PROXMUX Field Mapping

Use these values in PROXMUX settings:

- `User & Realm` -> `USER_REALM` (for example `api-admin@pve`)
- `Token ID` -> `TOKEN_ID`
- `API Secret` -> `TOKEN_SECRET`
- `Proxmox URL` -> `https://YOUR_HOST:8006`

## Optional Helper Script

Use the interactive helper:

```bash
bash scripts/setup_proxmox_token.sh
```

### Run directly from GitHub (pinned version on Proxmox host)

```bash
# Update v1.1.4 to the PROXMUX Manager version you are using
curl -fsSL 'https://raw.githubusercontent.com/d0dg3r/PROXMUX-Manager/v1.1.4/scripts/setup_proxmox_token.sh' -o '/tmp/setup_proxmox_token.sh' && chmod 700 '/tmp/setup_proxmox_token.sh' && bash '/tmp/setup_proxmox_token.sh'
```

This command is zsh-safe (URL is single-quoted) and pins the script to a specific version; you can optionally open `/tmp/setup_proxmox_token.sh` to review it before running, and adjust the tag when you upgrade PROXMUX Manager.

The script can:

- create a new API user or use an existing one,
- assign ACL role/path,
- create token with optional `--privsep 0`,
- store a unique token record file with mode `600`,
- print ready-to-copy PROXMUX values and curl test commands,
- print explicit post-import deletion instructions.

## zsh-safe curl example (copy/paste)

```bash
curl -k -s -H 'Authorization: PVEAPIToken=USER_REALM!TOKEN_ID=TOKEN_SECRET' 'https://YOUR_HOST:8006/api2/json/cluster/resources?type=vm'
```

Keep both header and URL in single quotes when using zsh.
