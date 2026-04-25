import subprocess
import pandas as pd
import re

# ─────────────────────────────────────────────
# WINDOWS VERSION AWARE PARENT RELATIONSHIPS
# ─────────────────────────────────────────────

# Windows 7 boot chain is different from Win10
# Win7: smss → csrss/winlogon directly (no separate wininit session)
# Win10: smss → wininit → services/lsass

KNOWN_PARENTS_WIN7 = {
    "system":           {"", "idle"},
    "registry":         {"system"},
    "smss.exe":         {"system"},
    "csrss.exe":        {"smss.exe", ""},       # Win7 smss spawns csrss directly
    "winlogon.exe":     {"smss.exe", ""},        # Win7 smss spawns winlogon directly
    "wininit.exe":      {"smss.exe", ""},
    "services.exe":     {"wininit.exe", "winlogon.exe"},  # Win7 services under winlogon
    "lsass.exe":        {"wininit.exe", "winlogon.exe"},
    "lsm.exe":          {"wininit.exe", "winlogon.exe"},  # Win7 only
    "svchost.exe":      {"services.exe"},
    "spoolsv.exe":      {"services.exe"},
    "explorer.exe":     {"userinit.exe"},
    "userinit.exe":     {"winlogon.exe"},
    "taskhost.exe":     {"services.exe"},
    "dwm.exe":          {"winlogon.exe", "svchost.exe"},
    "audiodg.exe":      {"svchost.exe"},
    "dllhost.exe":      {"svchost.exe", "services.exe"},
    "msdtc.exe":        {"services.exe"},
    "vssvc.exe":        {"services.exe"},
    "wmiapSrv.exe":     {"services.exe"},
    "wmiprvse.exe":     {"svchost.exe"},
    "searchindexer.exe":{"services.exe"},
    "searchindexer.":   {"services.exe"},    # Volatility truncated version
    "searchprotocolhost.exe": {"searchindexer.exe", "searchindexer."},
    "searchprotocol":   {"searchindexer.exe", "searchindexer."},  # truncated
    "searchfilterhost.exe":   {"searchindexer.exe", "searchindexer."},
    "searchfilterho":   {"searchindexer.exe", "searchindexer."},  # truncated
    "wmpnetwk.exe":     {"services.exe"},
    "vm3dservice.exe":  {"services.exe", "explorer.exe"},
    "vmtoolsd.exe":     {"services.exe", "explorer.exe"},
    "vgauthservice.exe":{"services.exe"},
}

KNOWN_PARENTS_WIN10 = {
    "system":           {"", "idle"},
    "registry":         {"system"},
    "smss.exe":         {"system"},
    "csrss.exe":        {"smss.exe"},
    "wininit.exe":      {"smss.exe"},
    "winlogon.exe":     {"smss.exe"},
    "services.exe":     {"wininit.exe"},
    "lsass.exe":        {"wininit.exe"},
    "svchost.exe":      {"services.exe"},
    "spoolsv.exe":      {"services.exe"},
    "explorer.exe":     {"userinit.exe"},
    "userinit.exe":     {"winlogon.exe"},
    "taskhostw.exe":    {"services.exe", "svchost.exe"},
    "dwm.exe":          {"winlogon.exe", "svchost.exe"},
    "fontdrvhost.exe":  {"wininit.exe", "winlogon.exe"},
    "fontdrvhost.ex":   {"wininit.exe", "winlogon.exe"},  # truncated
    "sihost.exe":       {"svchost.exe"},
    "ctfmon.exe":       {"svchost.exe"},
    "audiodg.exe":      {"svchost.exe"},
    "dllhost.exe":      {"svchost.exe", "services.exe"},
    "msdtc.exe":        {"services.exe"},
    "searchindexer.exe":{"services.exe"},
    "searchindexer.":   {"services.exe"},    # Volatility truncated version
    "wmiprvse.exe":     {"svchost.exe"},
    "runtimebroker.exe":{"svchost.exe"},
    "runtimebroker.":   {"svchost.exe"},     # truncated
    "searchapp.exe":    {"svchost.exe"},
    "startmenuexperiencehost.exe": {"svchost.exe"},
}

BROWSERS = {
    "chrome.exe", "msedge.exe", "firefox.exe",
    "iexplore.exe", "opera.exe", "brave.exe"
}

NO_NETWORK_PROCS = {
    "lsass.exe", "csrss.exe", "smss.exe",
    "wininit.exe", "lsm.exe",
}

# ─────────────────────────────────────────────
# GLOBALS
# ─────────────────────────────────────────────
suspicious = []
patterns   = []
os_version = "unknown"


def flag(pid, ppid, name, reason, severity="MEDIUM"):
    suspicious.append({
        "pid": pid, "ppid": ppid,
        "name": name, "reason": reason,
        "severity": severity,
    })
    emoji = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢"}.get(severity, "⚪")
    print(f"  {emoji} [{severity}] PID {pid} ({name}) → {reason}")


def add_pattern(pid, ppid, name, pattern_type):
    patterns.append({
        "pid": pid, "ppid": ppid,
        "name": name, "pattern_type": pattern_type,
    })


# ─────────────────────────────────────────────
# DETECT WINDOWS VERSION
# ─────────────────────────────────────────────
def detect_os(rows):
    """Detect Win7 vs Win10 based on process list.
    Handles Volatility truncated names (fontdrvhost.ex not fontdrvhost.exe)
    """
    global os_version
    names = {r["name"].lower() for r in rows}

    # Win7 indicator — lsm.exe only exists in Win7
    if "lsm.exe" in names:
        os_version = "win7"
        print("  → Detected: Windows 7")
        return KNOWN_PARENTS_WIN7

    # Win10 indicators — check both full and truncated names
    win10_indicators = {
        "fontdrvhost.exe", "fontdrvhost.ex",  # truncated by Volatility
        "runtimebroker.exe", "runtimebroker.",
        "memcompression",                      # Win10 memory compression
        "sihost.exe",                          # Shell Infrastructure Host
        "startmenuexperiencehost.exe",
    }
    if names & win10_indicators:
        os_version = "win10"
        print("  → Detected: Windows 10/11")
        return KNOWN_PARENTS_WIN10

    else:
        os_version = "win7"
        print("  → OS unknown — defaulting to Win7 rules")
        return KNOWN_PARENTS_WIN7


# ─────────────────────────────────────────────
# PLUGIN 1 — PSLIST
# ─────────────────────────────────────────────
def run_pslist(memfile):
    print("\n[+] Running pslist...")
    cmd = ["vol", "-f", memfile, "windows.pslist"]
    result = subprocess.run(cmd, capture_output=True, text=True)

    rows = []
    pid_to_name = {}
    pid_to_ppid = {}
    name_count  = {}

    for line in result.stdout.splitlines():
        parts = line.split()
        if not parts or not parts[0].isdigit():
            continue

        pid     = int(parts[0])
        ppid    = int(parts[1])
        name    = parts[2]
        threads = int(parts[4]) if len(parts) > 4 and parts[4].isdigit() else 0
        session = parts[6]      if len(parts) > 6 else "N/A"
        wow64   = parts[7]      if len(parts) > 7 else "False"

        # Detect exit time
        has_exit = False
        if len(parts) > 10:
            exit_val = parts[9] if len(parts) > 9 else "N/A"
            has_exit = exit_val not in ("N/A", "Disabled", "-")

        rows.append({
            "pid":      pid,
            "ppid":     ppid,
            "name":     name,
            "threads":  threads,
            "session":  session,
            "wow64":    wow64 == "True",
            "has_exit": has_exit,
        })

        pid_to_name[pid] = name.lower()
        pid_to_ppid[pid] = ppid
        name_count[name.lower()] = name_count.get(name.lower(), 0) + 1

    # Detect OS version
    KNOWN_PARENTS = detect_os(rows)
    all_pids = set(pid_to_name.keys())

    for row in rows:
        pid         = row["pid"]
        ppid        = row["ppid"]
        name        = row["name"]
        lname       = name.lower()
        parent_name = pid_to_name.get(ppid, "").lower()

        # ── Rule 1: Orphan process
        # Skip PPID=0 (normal for System/smss)
        # Skip boot processes — smss.exe exits after spawning them
        # so their parent (smss) won't appear in pslist — this is normal
        boot_procs = {
            "system", "registry", "smss.exe", "csrss.exe",
            "wininit.exe", "winlogon.exe", "services.exe",
            "lsass.exe", "lsm.exe", "userinit.exe",
            # Browsers / apps often launched standalone — parent exits
            "brave.exe", "chrome.exe", "firefox.exe",
            "microsoftedgeu",   # Edge updater — truncated
            "microsoftedgeupdate.exe",
        }
        if ppid != 0 and ppid not in all_pids and lname not in boot_procs:
            flag(pid, ppid, name, "orphan_process_parent_not_in_list", "HIGH")
            add_pattern(pid, ppid, name, "orphan")

        # ── Rule 2: Wrong parent for known process
        # Allow empty parent for boot processes — smss exits before dump
        # so csrss/wininit/winlogon will show empty parent — this is normal
        BOOT_EMPTY_PARENT_OK = {
            "csrss.exe", "wininit.exe", "winlogon.exe",
            "services.exe", "lsass.exe", "lsm.exe",
        }
        if lname in KNOWN_PARENTS:
            allowed = KNOWN_PARENTS[lname]
            # If parent is empty AND process is a boot process → skip
            if parent_name == "" and lname in BOOT_EMPTY_PARENT_OK:
                pass  # normal — smss exited before dump
            elif "" not in allowed and parent_name not in allowed and ppid != 0:
                flag(pid, ppid, name,
                     f"wrong_parent: got={parent_name!r} expected_one_of={allowed}",
                     "HIGH")
                add_pattern(pid, ppid, name, "wrong_parent")

        # ── Rule 3: svchost NOT spawned by services.exe
        if lname == "svchost.exe" and parent_name not in {"services.exe", ""}:
            flag(pid, ppid, name,
                 f"svchost_wrong_parent: parent={parent_name}",
                 "CRITICAL")
            add_pattern(pid, ppid, name, "svchost_wrong_parent")

        # ── Rule 4: System process in user session (session 1)
        # Note: csrss.exe excluded — Win7 runs TWO csrss instances:
        #       one for session 0, one for session 1 — both legitimate
        session_sensitive = {
            "lsass.exe", "services.exe",
            "wininit.exe", "lsm.exe", "smss.exe"
        }
        if lname in session_sensitive and str(row["session"]) == "1":
            flag(pid, ppid, name, "system_proc_in_user_session", "CRITICAL")
            add_pattern(pid, ppid, name, "wrong_session")

        # ── Rule 5: 32bit system process
        if row["wow64"] and lname in {
            "svchost.exe", "lsass.exe", "services.exe",
            "csrss.exe", "wininit.exe", "smss.exe"
        }:
            flag(pid, ppid, name, "system_process_running_32bit", "HIGH")
            add_pattern(pid, ppid, name, "wow64_system")

        # ── Rule 6: Shell spawned by Office or browser
        office = {"winword.exe","excel.exe","powerpnt.exe","outlook.exe"}
        shells = {"cmd.exe","powershell.exe","wscript.exe","cscript.exe"}
        if lname in shells and parent_name in office:
            flag(pid, ppid, name,
                 f"shell_from_office: parent={parent_name}", "CRITICAL")
            add_pattern(pid, ppid, name, "office_shell_spawn")

        if lname in shells and parent_name in BROWSERS:
            flag(pid, ppid, name,
                 f"shell_from_browser: parent={parent_name}", "CRITICAL")
            add_pattern(pid, ppid, name, "browser_shell_spawn")

        # ── Rule 7: Zero threads + no exit = hollow process
        if row["threads"] == 0 and not row["has_exit"]:
            flag(pid, ppid, name, "zero_threads_possible_hollow", "HIGH")
            add_pattern(pid, ppid, name, "zero_threads")

        # ── Rule 8: Unusual characters in name
        if re.search(r'[^a-zA-Z0-9._\-]', name):
            flag(pid, ppid, name, "unusual_chars_in_name", "MEDIUM")
            add_pattern(pid, ppid, name, "unusual_name")

        # ── Rule 9: Multiple instances of single-instance processes
        single_instance = {
            "lsass.exe", "services.exe", "wininit.exe",
            "lsm.exe", "explorer.exe", "spoolsv.exe"
        }
        if lname in single_instance and name_count.get(lname, 0) > 1:
            flag(pid, ppid, name,
                 f"multiple_instances_of_single_instance_process: count={name_count[lname]}",
                 "HIGH")
            add_pattern(pid, ppid, name, "multiple_instances")

        # ── Pattern: browser tracking
        if lname in BROWSERS:
            add_pattern(pid, ppid, name, "browser")

        # ── Rule 10: Typosquatting — names that look like system processes
        # Attacker swaps letters to mimic legitimate names
        TYPOSQUATS = {
            "scvhost.exe":   "svchost.exe",   # s-C-vhost vs s-V-chost
            "svhost.exe":    "svchost.exe",   # missing c
            "svchosl.exe":   "svchost.exe",   # l instead of t
            "lsasss.exe":    "lsass.exe",     # extra s
            "csrss_.exe":    "csrss.exe",     # underscore
            "explore.exe":   "explorer.exe",  # missing r
            "iexplore.exe":  "iexplore.exe",  # legitimate — skip
        }
        if lname in TYPOSQUATS:
            flag(pid, ppid, name,
                 f"typosquatting: {name} looks like {TYPOSQUATS[lname]}",
                 "CRITICAL")
            add_pattern(pid, ppid, name, "typosquatting")

        # ── Rule 11: Double extension — file.exe.exe pattern
        # Volatility truncates to 15 chars so svchost.exe.exe → svchost.exe.ex
        if lname.endswith(".exe.ex") or lname.count(".exe") > 1:
            flag(pid, ppid, name,
                 f"double_extension_malware: {name}",
                 "CRITICAL")
            add_pattern(pid, ppid, name, "double_extension")

        # ── Rule 12: Screensaver (.scr) running as process — often malware
        if lname.endswith(".scr"):
            flag(pid, ppid, name,
                 f"screensaver_executable_suspicious: {name}",
                 "HIGH")
            add_pattern(pid, ppid, name, "scr_executable")

    df = pd.DataFrame(rows)
    print(f"  → {len(df)} processes parsed")
    return df, pid_to_name, KNOWN_PARENTS


# ─────────────────────────────────────────────
# PLUGIN 2 — PSSCAN (hidden process detection)
# ─────────────────────────────────────────────
def run_psscan(memfile, pslist_df):
    print("\n[+] Running psscan (hidden process detection)...")
    cmd = ["vol", "-f", memfile, "windows.psscan"]
    result = subprocess.run(cmd, capture_output=True, text=True)

    psscan_pids  = set()
    psscan_names = {}

    for line in result.stdout.splitlines():
        parts = line.split()
        if parts and parts[0].isdigit():
            pid  = int(parts[0])
            name = parts[2] if len(parts) > 2 else "unknown"
            psscan_pids.add(pid)
            psscan_names[pid] = name

    pslist_pids = set(pslist_df["pid"].tolist())

    # Processes that legitimately appear in psscan but not pslist
    # because they already terminated before dump was taken
    LEGITIMATE_TERMINATED = {
        "searchfilterho", "searchprotocol", "searchindexer",
        "wuauclt.exe",    # Windows Update — terminates after update
        "am_delta.exe",   # Windows Defender signature update
        "mpsigstub.exe",  # Windows Defender stub
        "wudfhost.exe",   # Windows Driver Foundation — terminates
        "wmiadap.exe",    # WMI performance adapter — terminates
        "runtimebroker.", # Runtime Broker — multiple short lived instances
        "ftk",            # FTK Imager — used to capture the dump itself
        "ftk imager",
        "dumpit.exe",     # DumpIt — memory capture tool
        "winpmem",        # WinPmem — memory capture tool
    }

    # In psscan but NOT in pslist = potentially hidden
    hidden_pids = psscan_pids - pslist_pids
    for pid in hidden_pids:
        name     = psscan_names.get(pid, "UNKNOWN")
        namelower= name.lower()

        # Skip known legitimate terminated processes
        is_legit_terminated = any(
            namelower.startswith(t) or namelower == t
            for t in LEGITIMATE_TERMINATED
        )
        if is_legit_terminated:
            continue

        # Flag as hidden/rootkit
        flag(pid, None, name, "hidden_process_rootkit", "CRITICAL")
        add_pattern(pid, None, name, "hidden_process")

    actual_hidden = sum(
        1 for pid in hidden_pids
        if not any(
            psscan_names.get(pid,"").lower().startswith(t)
            for t in LEGITIMATE_TERMINATED
        )
    )
    print(f"  → pslist: {len(pslist_pids)} | psscan: {len(psscan_pids)} | "
          f"terminated: {len(hidden_pids)-actual_hidden} | "
          f"truly hidden: {actual_hidden}")
    return psscan_pids


# ─────────────────────────────────────────────
# PLUGIN 3 — CMDLINE
# ─────────────────────────────────────────────
def run_cmdline(memfile):
    print("\n[+] Running cmdline...")
    cmd = ["vol", "-f", memfile, "windows.cmdline"]
    result = subprocess.run(cmd, capture_output=True, text=True)

    rows = []
    for line in result.stdout.splitlines():
        m = re.match(r'^(\d+)\s+(\S+)\s+(.+)$', line.strip())
        if not m:
            continue

        pid     = int(m.group(1))
        name    = m.group(2)
        cmdline = m.group(3)
        cl_low  = cmdline.lower()

        rows.append({"pid": pid, "name": name, "cmdline": cmdline})

        # Suspicious cmdline patterns
        bad = {
            "-enc":              "encoded_powershell",
            "-encodedcommand":   "encoded_powershell",
            "invoke-expression": "powershell_iex",
            "downloadstring":    "powershell_download",
            "iex(":              "powershell_iex",
            "-bypass":           "execution_policy_bypass",
            "-hidden":           "hidden_window",
            "certutil":          "certutil_abuse",
            "regsvr32":          "regsvr32_abuse",
            "mshta":             "mshta_abuse",
            "bitsadmin":         "bitsadmin_abuse",
            "net user":          "user_enumeration",
            "net localgroup":    "group_enumeration",
            "whoami":            "recon_whoami",
            "ipconfig":          "recon_network",
            "mimikatz":          "credential_tool",
            "procdump":          "credential_dump",
        }
        for keyword, reason in bad.items():
            if keyword in cl_low:
                flag(pid, None, name, f"cmdline_{reason}", "HIGH")
                add_pattern(pid, None, name, f"cmdline_{reason}")
                break

        # Check path — running from suspicious location
        # Whitelist: processes that legitimately use temp/appdata paths
        # Note: Volatility truncates long names so we check startswith too
        TEMP_PATH_WHITELIST = {
            "searchprotocolhost.exe", "searchfilterhost.exe",
            "searchindexer.exe", "msiexec.exe",
            "trustedinstaller.exe", "tiworker.exe", "wuauclt.exe",
            # AppData whitelist
            "onedrive.exe", "teams.exe", "slack.exe",
            "discord.exe", "spotify.exe", "microsoftedgeupdate.exe",
            # Memory capture tools — legitimately on desktop
            "dumpit.exe", "winpmem.exe", "ftk imager.exe",
            "ftk", "rammap.exe", "memorydump.exe",
        }
        # Truncated prefixes
        TEMP_PATH_WHITELIST_PREFIX = (
            "searchprotocol",   # SearchProtocolHost.exe
            "searchfilterho",   # SearchFilterHost.exe
            "searchindexer",    # SearchIndexer.exe
            "trustedinstall",   # TrustedInstaller.exe
            "onedrive",         # OneDrive.exe and variants
            "microsoftedge",    # Edge updater
        )
        suspicious_paths = ["\\temp\\", "\\downloads\\",
                            "\\desktop\\", "\\public\\", "%temp%"]
        # Note: \appdata\ removed from suspicious — too many legit apps use it
        # We only flag appdata if combined with other suspicious indicators
        appdata_paths = ["\\appdata\\roaming\\", "\\appdata\\local\\temp\\"]

        proc_lower = name.lower()
        is_whitelisted = (
            proc_lower in TEMP_PATH_WHITELIST or
            proc_lower.startswith(TEMP_PATH_WHITELIST_PREFIX)
        )
        for sp in suspicious_paths:
            if sp in cl_low and not is_whitelisted:
                flag(pid, None, name, f"running_from_suspicious_path: {sp}", "HIGH")
                add_pattern(pid, None, name, "suspicious_path")
                break
        # Only flag appdata\local\temp — not all appdata
        for sp in appdata_paths:
            if sp in cl_low and not is_whitelisted:
                flag(pid, None, name, f"running_from_suspicious_path: {sp}", "HIGH")
                add_pattern(pid, None, name, "suspicious_path")
                break

    df = pd.DataFrame(rows) if rows else pd.DataFrame(
        columns=["pid", "name", "cmdline"])
    print(f"  → {len(df)} cmdline entries")
    return df


# ─────────────────────────────────────────────
# PLUGIN 4 — NETSCAN
# ─────────────────────────────────────────────
def run_netscan(memfile):
    print("\n[+] Running netscan...")
    cmd = ["vol", "-f", memfile, "windows.netscan"]
    result = subprocess.run(cmd, capture_output=True, text=True)

    rows = []
    # Track external IPs per PID for cross correlation later
    external_ips = {}

    for line in result.stdout.splitlines():
        parts = line.split()
        if not parts or not parts[0].startswith("0x"):
            continue
        if len(parts) < 8:
            continue

        try:
            proto       = parts[1]
            local_addr  = parts[2]
            local_port  = parts[3]
            foreign_addr= parts[4]
            foreign_port= parts[5]
            state       = parts[6]
            pid         = int(parts[7]) if parts[7].isdigit() else None
            proc        = parts[8].lower() if len(parts) > 8 else ""

            rows.append({
                "proto":        proto,
                "local_addr":   local_addr,
                "local_port":   local_port,
                "foreign_addr": foreign_addr,
                "foreign_port": foreign_port,
                "state":        state,
                "pid":          pid,
                "process":      proc,
            })

            if pid is None:
                continue

            # ── Rule: System process with network connection
            if proc in NO_NETWORK_PROCS and state not in ("LISTENING", "CLOSED"):
                flag(pid, None, proc,
                     f"system_proc_active_network: {foreign_addr}:{foreign_port}",
                     "CRITICAL")
                add_pattern(pid, None, proc, "system_network")

            # ── Rule: External IP connection (not private/loopback)
            is_private = (
                foreign_addr.startswith("192.168.") or
                foreign_addr.startswith("10.")       or
                foreign_addr.startswith("172.")      or
                foreign_addr in ("0.0.0.0", "*", "-", "::") or
                foreign_addr.startswith("127.")      or
                foreign_addr.startswith("fe80:")     or
                foreign_addr.startswith("::")        or
                foreign_addr == "::1"                or
                "ffff" in foreign_addr               or  # Windows internal IPv6 addresses
                foreign_addr == "-"                     # unknown/closed connections
            )
            if not is_private and foreign_addr not in ("*", "-") and state == "CLOSED":
                flag(pid, None, proc,
                     f"external_ip_connection: {foreign_addr}:{foreign_port}",
                     "HIGH")
                add_pattern(pid, None, proc, "external_connection")
                if pid not in external_ips:
                    external_ips[pid] = []
                external_ips[pid].append(foreign_addr)

            # ── Rule: Non-browser SYN_SENT
            if state == "SYN_SENT" and proc not in BROWSERS:
                flag(pid, None, proc,
                     f"nonbrowser_syn_sent: {foreign_addr}",
                     "MEDIUM")
                add_pattern(pid, None, proc, "syn_sent")

        except (IndexError, ValueError):
            continue

    df = pd.DataFrame(rows) if rows else pd.DataFrame(
        columns=["proto","local_addr","local_port",
                 "foreign_addr","foreign_port","state","pid","process"])
    print(f"  → {len(df)} network entries")
    return df, external_ips


# ─────────────────────────────────────────────
# PLUGIN 5 — MALFIND
# ─────────────────────────────────────────────
def run_malfind(memfile):
    print("\n[+] Running malfind...")
    cmd = ["vol", "-f", memfile, "windows.malware.malfind"]
    result = subprocess.run(cmd, capture_output=True, text=True)

    # Fallback to old plugin path if new one fails
    if result.returncode != 0 or not result.stdout.strip():
        cmd = ["vol", "-f", memfile, "windows.malfind"]
        result = subprocess.run(cmd, capture_output=True, text=True)

    rows = []
    shellcode_signatures = {}

    # Win10 processes known to legitimately have RWX memory
    # due to JIT compilation, antivirus scanning, memory management
    # Flagging these creates too many false positives
    MALFIND_WHITELIST = {
        "msmpeng.exe",      # Windows Defender — uses RWX for AV scanning
        "mssense.exe",      # Windows Defender ATP
        "nissrv.exe",       # Windows Defender Network Inspection
        "searchapp.exe",    # Windows Search — JIT compiled
        "searchui.exe",     # Windows Search UI
        "smartscreen.ex",   # SmartScreen — security scanning (truncated)
        "smartscreen.exe",  # SmartScreen full name
        "onedrive.exe",     # OneDrive sync engine
        "microsoftedge",    # Edge browser processes
        "svchost.exe",      # Only flag if combined with other indicators
    }

    for line in result.stdout.splitlines():
        # Skip headers, warnings, empty lines
        if not line.strip():
            continue
        if line.startswith("PID") or "FutureWarning" in line or \
           "deprecated" in line.lower() or "warning" in line.lower():
            continue

        parts = line.split()
        if not parts or not parts[0].isdigit():
            continue
        if len(parts) < 5:
            continue

        try:
            pid  = int(parts[0])
            name = parts[1]

            # Find protection field — look for PAGE_ pattern
            protection = ""
            for part in parts:
                if part.startswith("PAGE_"):
                    protection = part
                    break

            if not protection:
                continue

            if "EXECUTE_READWRITE" not in protection.upper():
                continue

            # Skip whitelisted processes — known legitimate RWX users
            if name.lower() in MALFIND_WHITELIST:
                continue

            # Get address — usually parts[2]
            address = parts[2] if len(parts) > 2 else "unknown"

            rows.append({
                "pid":        pid,
                "name":       name,
                "address":    address,
                "protection": protection,
            })

            flag(pid, None, name,
                 f"malfind_rwx_memory_at_{address}",
                 "CRITICAL")
            add_pattern(pid, None, name, "malfind_rwx")

            if name.lower() not in shellcode_signatures:
                shellcode_signatures[name.lower()] = []
            shellcode_signatures[name.lower()].append(pid)

        except (IndexError, ValueError):
            continue

    # Widespread injection check
    for proc_name, pids in shellcode_signatures.items():
        if len(pids) > 1:
            for pid in pids:
                flag(pid, None, proc_name,
                     f"same_shellcode_in_multiple_{proc_name}_count={len(pids)}",
                     "CRITICAL")
                add_pattern(pid, None, proc_name, "widespread_injection")

    df = pd.DataFrame(rows) if rows else pd.DataFrame(
        columns=["pid", "name", "address", "protection"])
    print(f"  → {len(df)} RWX memory regions found")
    return df


# ─────────────────────────────────────────────
# CROSS CORRELATION
# The most important detection!
# ─────────────────────────────────────────────
def cross_correlate(pslist_df, malfind_df, external_ips):
    print("\n[+] Cross correlating findings...")

    malfind_pids = set(malfind_df["pid"].tolist()) if not malfind_df.empty else set()
    ext_pids     = set(external_ips.keys())

    # Process with BOTH injection AND external connection = confirmed C2
    c2_pids = malfind_pids & ext_pids
    for pid in c2_pids:
        name = pslist_df[pslist_df["pid"] == pid]["name"].values
        name = name[0] if len(name) > 0 else "UNKNOWN"
        ips  = external_ips[pid]
        flag(pid, None, name,
             f"CONFIRMED_C2: injected_process_with_external_connection_to_{ips}",
             "CRITICAL")
        add_pattern(pid, None, name, "confirmed_c2")
        print(f"  💀 CONFIRMED C2 COMMUNICATION: PID {pid} ({name}) → {ips}")

    print(f"  → C2 processes found: {len(c2_pids)}")


# ─────────────────────────────────────────────
# BUILD ML FEATURE DATAFRAME
# ─────────────────────────────────────────────
def build_features(pslist_df, cmdline_df, netscan_df,
                   malfind_df, psscan_pids, external_ips):
    print("\n[+] Building ML feature dataframe...")

    pslist_pids = set(pslist_df["pid"].tolist())

    malfind_counts = {}
    if not malfind_df.empty:
        malfind_counts = malfind_df.groupby("pid").size().to_dict()

    net_counts = {}
    if not netscan_df.empty and "pid" in netscan_df.columns:
        valid = netscan_df[netscan_df["pid"].notna()]
        net_counts = valid.groupby("pid").size().to_dict()

    sus_df = pd.DataFrame(suspicious)
    sus_counts = {}
    if not sus_df.empty and "pid" in sus_df.columns:
        sus_counts = sus_df.groupby("pid").size().to_dict()

    features = []
    for _, row in pslist_df.iterrows():
        pid = row["pid"]

        pid_patterns = [p["pattern_type"] for p in patterns if p["pid"] == pid]

        # Severity score — convert flags to numeric
        pid_sus = [s for s in suspicious if s["pid"] == pid]
        sev_score = sum({
            "CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1
        }.get(s["severity"], 0) for s in pid_sus)

        feat = {
            # Identity
            "pid":                   pid,
            "name":                  row["name"],
            "ppid":                  row["ppid"],

            # Raw features
            "threads":               row["threads"],
            "session":               int(row["session"]) if str(row["session"]).isdigit() else -1,
            "wow64":                 int(row["wow64"]),
            "has_exit":              int(row["has_exit"]),

            # Cross plugin features
            "in_psscan":             int(pid in psscan_pids),
            "is_hidden":             int(pid not in pslist_pids and pid in psscan_pids),
            "malfind_count":         malfind_counts.get(pid, 0),
            "network_connections":   net_counts.get(pid, 0),
            "has_external_ip":       int(pid in external_ips),
            "external_ip_count":     len(external_ips.get(pid, [])),

            # Pattern binary flags
            "is_orphan":             int("orphan" in pid_patterns),
            "wrong_parent":          int("wrong_parent" in pid_patterns),
            "svchost_wrong_parent":  int("svchost_wrong_parent" in pid_patterns),
            "wow64_system":          int("wow64_system" in pid_patterns),
            "has_malfind":           int("malfind_rwx" in pid_patterns),
            "widespread_injection":  int("widespread_injection" in pid_patterns),
            "confirmed_c2":          int("confirmed_c2" in pid_patterns),
            "suspicious_cmdline":    int(any("cmdline" in p for p in pid_patterns)),
            "suspicious_path":       int("suspicious_path" in pid_patterns),
            "wrong_session":         int("wrong_session" in pid_patterns),
            "zero_threads":          int("zero_threads" in pid_patterns),
            "double_extension":      int("double_extension" in pid_patterns),
            "typosquatting":         int("typosquatting" in pid_patterns),
            "scr_executable":        int("scr_executable" in pid_patterns),
            "office_shell_spawn":    int("office_shell_spawn" in pid_patterns),
            "browser_shell_spawn":   int("browser_shell_spawn" in pid_patterns),
            "multiple_instances":    int("multiple_instances" in pid_patterns),
            "system_network":        int("system_network" in pid_patterns),

            # Overall suspicion score
            "severity_score":        sev_score,

            # Label placeholder for training
            # 0 = clean, 1 = malicious
            # Fill manually or via VirusTotal later
            "label":                 -1,
        }
        features.append(feat)

    df = pd.DataFrame(features)
    print(f"  → Feature matrix: {df.shape[0]} rows × {df.shape[1]} columns")
    return df


# ─────────────────────────────────────────────
# SAVE ALL
# ─────────────────────────────────────────────
def save_all(pslist_df, cmdline_df, netscan_df,
             malfind_df, features_df, outdir="."):

    pslist_df.to_csv(  f"{outdir}/pslist.csv",   index=False)
    cmdline_df.to_csv( f"{outdir}/cmdline.csv",  index=False)
    netscan_df.to_csv( f"{outdir}/netscan.csv",  index=False)
    malfind_df.to_csv( f"{outdir}/malfind.csv",  index=False)
    features_df.to_csv(f"{outdir}/features.csv", index=False)

    if suspicious:
        pd.DataFrame(suspicious).drop_duplicates().to_csv(
            f"{outdir}/suspicious.csv", index=False)

    if patterns:
        pd.DataFrame(patterns).drop_duplicates().to_csv(
            f"{outdir}/patterns.csv", index=False)

    print(f"\n✅ Saved to {outdir}/")
    print(f"   pslist.csv  cmdline.csv  netscan.csv")
    print(f"   malfind.csv features.csv")
    print(f"   suspicious.csv  patterns.csv")

from datetime import datetime, timezone
import json

def save_to_mongodb(
    investigation_id,
    memfile,
    pslist_df,
    cmdline_df,
    netscan_df,
    malfind_df,
    features_df,
    outdir="."
):
    """
    Saves all pipeline output in MongoDB-ready format.
    Returns a single investigation document.
    """
    import os
    os.makedirs(outdir, exist_ok=True)  # create output dir if not exists

    timestamp = datetime.now(timezone.utc).isoformat()  # timezone-aware UTC

    # ── 1. Investigation document ──────────────────
    investigation = {
        "_id":            investigation_id,
        "memfile":        memfile,
        "os_version":     os_version,
        "analyzed_at":    timestamp,
        "status":         "completed",
        "total_processes": len(pslist_df),
        "total_suspicious": len(suspicious),
        "total_patterns":  len(patterns),
        "summary": {
            "critical": len([s for s in suspicious if s["severity"] == "CRITICAL"]),
            "high":     len([s for s in suspicious if s["severity"] == "HIGH"]),
            "medium":   len([s for s in suspicious if s["severity"] == "MEDIUM"]),
            "low":      len([s for s in suspicious if s["severity"] == "LOW"]),
        }
    }

    # ── 2. Processes ───────────────────────────────
    processes = []
    for _, row in pslist_df.iterrows():
        processes.append({
            "investigation_id": investigation_id,
            "pid":    int(row["pid"]),
            "ppid":   int(row["ppid"]),
            "name":   row["name"],
            "threads":int(row["threads"]),
            "session":str(row["session"]),
            "wow64":  bool(row["wow64"]),
            "has_exit":bool(row["has_exit"]),
        })

    # ── 3. Network connections ─────────────────────
    network = []
    if not netscan_df.empty:
        for _, row in netscan_df.iterrows():
            network.append({
                "investigation_id": investigation_id,
                "proto":        row.get("proto", ""),
                "local_addr":   row.get("local_addr", ""),
                "local_port":   str(row.get("local_port", "")),
                "foreign_addr": row.get("foreign_addr", ""),
                "foreign_port": str(row.get("foreign_port", "")),
                "state":        row.get("state", ""),
                "pid":          int(row["pid"]) if pd.notna(row.get("pid")) else None,
                "process":      row.get("process", ""),
            })

    # ── 4. Malfind ─────────────────────────────────
    injections = []
    if not malfind_df.empty:
        for _, row in malfind_df.iterrows():
            injections.append({
                "investigation_id": investigation_id,
                "pid":        int(row["pid"]),
                "name":       row["name"],
                "address":    row["address"],
                "protection": row["protection"],
            })

    # ── 5. Suspicious flags ────────────────────────
    sus_docs = []
    for s in suspicious:
        sus_docs.append({
            "investigation_id": investigation_id,
            "pid":      s["pid"],
            "name":     s["name"],
            "reason":   s["reason"],
            "severity": s["severity"],
        })

    # ── 6. ML Features ─────────────────────────────
    feature_docs = []
    if not features_df.empty:
        for _, row in features_df.iterrows():
            doc = row.to_dict()
            doc["investigation_id"] = investigation_id
            # label = -1 means unlabelled (fill manually later)
            feature_docs.append(doc)

    # ── 7. Save as JSON files (MongoDB importable) ─
    output = {
        "investigation": investigation,
        "processes":     processes,
        "network":       network,
        "injections":    injections,
        "suspicious":    sus_docs,
        "features":      feature_docs,
    }

    # Save as one JSON file per investigation
    json_path = f"{outdir}/{investigation_id}_output.json"
    with open(json_path, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\n✅ MongoDB-ready JSON saved: {json_path}")

    # Also save CSVs for ML training
    features_df.to_csv(f"{outdir}/{investigation_id}_features.csv", index=False)
    pd.DataFrame(sus_docs).to_csv(f"{outdir}/{investigation_id}_suspicious.csv", index=False)

    return output


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    import uuid

    memfile = sys.argv[1] if len(sys.argv) > 1 else "mem.mem"

    # Reset globals — important if running multiple dumps in same session
    suspicious.clear()
    patterns.clear()
    os_version = "unknown"

    # Generate unique ID for this investigation
    investigation_id = str(uuid.uuid4())[:8]

    print(f"\n{'='*55}")
    print(f"  ForensIQ Pipeline")
    print(f"  File:  {memfile}")
    print(f"  ID:    {investigation_id}")
    print(f"{'='*55}")

    pslist_df, pid_to_name, KNOWN_PARENTS = run_pslist(memfile)
    psscan_pids                            = run_psscan(memfile, pslist_df)
    cmdline_df                             = run_cmdline(memfile)
    netscan_df, external_ips               = run_netscan(memfile)
    malfind_df                             = run_malfind(memfile)

    cross_correlate(pslist_df, malfind_df, external_ips)

    features_df = build_features(
        pslist_df, cmdline_df, netscan_df,
        malfind_df, psscan_pids, external_ips
    )

    # Save MongoDB-ready output
    output = save_to_mongodb(
        investigation_id=investigation_id,
        memfile=memfile,
        pslist_df=pslist_df,
        cmdline_df=cmdline_df,
        netscan_df=netscan_df,
        malfind_df=malfind_df,
        features_df=features_df,
        outdir="./output"
    )

    print(f"\n{'='*55}")
    print(f"  SUMMARY")
    print(f"{'='*55}")
    print(f"  Investigation ID:   {investigation_id}")
    print(f"  OS Version:         {os_version}")
    print(f"  Total processes:    {len(pslist_df)}")
    print(f"  Suspicious flags:   {len(suspicious)}")
    print(f"  ML features ready:  {features_df.shape}")

    # Show critical findings
    if suspicious:
        print(f"\n  🚨 CRITICAL / HIGH FINDINGS:")
        sus_df = pd.DataFrame(suspicious)
        high   = sus_df[sus_df["severity"].isin(["CRITICAL","HIGH"])]
        if not high.empty:
            print(high[["pid","name","severity","reason"]].to_string(index=False))