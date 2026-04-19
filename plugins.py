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
    "searchprotocolhost.exe": {"searchindexer.exe"},
    "searchfilterhost.exe":   {"searchindexer.exe"},
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
    "sihost.exe":       {"svchost.exe"},
    "ctfmon.exe":       {"svchost.exe"},
    "audiodg.exe":      {"svchost.exe"},
    "dllhost.exe":      {"svchost.exe", "services.exe"},
    "msdtc.exe":        {"services.exe"},
    "searchindexer.exe":{"services.exe"},
    "wmiprvse.exe":     {"svchost.exe"},
    "runtimebroker.exe":{"svchost.exe"},
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
    """Detect Win7 vs Win10 based on process list."""
    global os_version
    names = {r["name"].lower() for r in rows}

    if "lsm.exe" in names:
        os_version = "win7"
        print("  → Detected: Windows 7")
        return KNOWN_PARENTS_WIN7

    elif "fontdrvhost.exe" in names or "runtimebroker.exe" in names:
        os_version = "win10"
        print("  → Detected: Windows 10/11")
        return KNOWN_PARENTS_WIN10

    else:
        os_version = "win7"  # default to win7 rules (more permissive)
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
        # Skip if parent simply exited before dump (common in Win7)
        boot_procs = {
            "system", "registry", "smss.exe", "csrss.exe",
            "wininit.exe", "winlogon.exe", "services.exe",
            "lsass.exe", "lsm.exe"
        }
        if ppid != 0 and ppid not in all_pids and lname not in boot_procs:
            flag(pid, ppid, name, "orphan_process_parent_not_in_list", "HIGH")
            add_pattern(pid, ppid, name, "orphan")

        # ── Rule 2: Wrong parent for known process
        if lname in KNOWN_PARENTS:
            allowed = KNOWN_PARENTS[lname]
            # Empty string means "no parent / boot process" — skip those
            if "" not in allowed and parent_name not in allowed and ppid != 0:
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
        session_sensitive = {
            "lsass.exe", "services.exe", "csrss.exe",
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

    # In psscan but NOT in pslist = hidden = rootkit
    hidden_pids = psscan_pids - pslist_pids
    for pid in hidden_pids:
        name = psscan_names.get(pid, "UNKNOWN")
        flag(pid, None, name, "hidden_process_rootkit", "CRITICAL")
        add_pattern(pid, None, name, "hidden_process")

    print(f"  → pslist: {len(pslist_pids)} | psscan: {len(psscan_pids)} | hidden: {len(hidden_pids)}")
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
        suspicious_paths = ["\\temp\\", "\\appdata\\", "\\downloads\\",
                            "\\desktop\\", "\\public\\", "%temp%"]
        for sp in suspicious_paths:
            if sp in cl_low:
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
                foreign_addr == "::1"
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
    cmd = ["vol", "-f", memfile, "windows.malfind"]
    result = subprocess.run(cmd, capture_output=True, text=True)

    rows = []
    # Track repeated shellcode patterns
    shellcode_signatures = {}

    for line in result.stdout.splitlines():
        parts = line.split()
        if not parts or not parts[0].isdigit():
            continue
        if len(parts) < 5:
            continue

        try:
            pid        = int(parts[0])
            name       = parts[1]
            address    = parts[2]
            protection = parts[4] if len(parts) > 4 else ""

            if "EXECUTE_READWRITE" not in protection.upper():
                continue

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

            # Track which PIDs have injected code
            if name.lower() not in shellcode_signatures:
                shellcode_signatures[name.lower()] = []
            shellcode_signatures[name.lower()].append(pid)

        except (IndexError, ValueError):
            continue

    # Check for same process name injected in multiple PIDs
    # = widespread injection / worm behavior
    for proc_name, pids in shellcode_signatures.items():
        if len(pids) > 1:
            for pid in pids:
                flag(pid, None, proc_name,
                     f"same_shellcode_in_multiple_{proc_name}_instances_count={len(pids)}",
                     "CRITICAL")
                add_pattern(pid, None, proc_name, "widespread_injection")

    df = pd.DataFrame(rows) if rows else pd.DataFrame(
        columns=["pid","name","address","protection"])
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


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    memfile = sys.argv[1] if len(sys.argv) > 1 else "mem.mem"

    print(f"\n{'='*55}")
    print(f"  ForensIQ Pipeline")
    print(f"  File: {memfile}")
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

    save_all(pslist_df, cmdline_df, netscan_df,
             malfind_df, features_df)

    print(f"\n{'='*55}")
    print(f"  SUMMARY — {memfile}")
    print(f"{'='*55}")
    print(f"  OS Version:         {os_version}")
    print(f"  Total processes:    {len(pslist_df)}")
    print(f"  Suspicious flags:   {len(suspicious)}")
    print(f"  Patterns detected:  {len(patterns)}")
    print(f"  External IPs found: {sum(len(v) for v in external_ips.values())}")
    print(f"  ML features ready:  {features_df.shape}")

    if suspicious:
        print(f"\n  🚨 SUSPICIOUS PROCESSES:")
        sus_df = pd.DataFrame(suspicious).drop_duplicates()
        # Show only CRITICAL and HIGH
        high = sus_df[sus_df["severity"].isin(["CRITICAL", "HIGH"])]
        if not high.empty:
            print(high[["pid","name","reason","severity"]].to_string(index=False))