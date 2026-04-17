import subprocess
import pandas as pd
import re

defaults = {"calc.exe", "notepad.exe", "cmd.exe", "powershell.exe"}
browser_names = {"chrome.exe", "msedge.exe", "firefox.exe", "iexplore.exe", "opera.exe", "brave.exe"}
system_names = {"winlogon.exe", "svchost.exe", "lsass.exe", "csrss.exe", "services.exe", "smss.exe"}

sus = []
patterns = []


def pslist(memfile):
    cmd = ["vol", "-f", memfile, "windows.pslist"]
    result = subprocess.run(cmd, capture_output=True, text=True)

    rows = []
    pid_to_name = {}
    pids = set()

    for line in result.stdout.splitlines():
        parts = line.split()
        if parts and parts[0].isdigit():
            pid = int(parts[0])
            ppid = int(parts[1])
            name = parts[2]
            rows.append((pid, ppid, name))
            pid_to_name[pid] = name
            pids.add(pid)

    for pid, ppid, name in rows:
        lname = name.lower()
        parent_name = pid_to_name.get(ppid, "").lower()

        if ppid not in pids:
            sus.append({"pid": pid, "ppid": ppid, "name": name, "reason": "orphan_process"})

        if parent_name == "svchost.exe" and lname in defaults:
            sus.append({"pid": pid, "ppid": ppid, "name": name, "reason": "unexpected_svchost_child"})

        if lname == "conhost.exe":
            sus.append({"pid": pid, "ppid": ppid, "name": name, "reason": "conhost_present"})

        if lname in system_names and parent_name not in {"", "services.exe", "smss.exe", "wininit.exe"}:
            sus.append({"pid": pid, "ppid": ppid, "name": name, "reason": "system_process_unusual_parent"})

        if lname in browser_names:
            patterns.append({"pid": pid, "ppid": ppid, "name": name, "reason": "browser_process"})

    return pd.DataFrame(rows, columns=["pid", "ppid", "name"])


def cmdline(memfile):
    cmd = ["vol", "-f", memfile, "windows.cmdline"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    rows = []
    for line in result.stdout.splitlines():
        m = re.match(r'^(\d+)\s+(\S+)\s+(.*)$', line.strip())
        if m:
            rows.append({"pid": int(m.group(1)), "name": m.group(2), "cmdline": m.group(3)})
            if any(x in m.group(3).lower() for x in ["powershell", "cmd.exe", "wscript", "cscript"]):
                sus.append({"pid": int(m.group(1)), "ppid": None, "name": m.group(2), "reason": "suspicious_cmdline"})
    return pd.DataFrame(rows)


def netscan(memfile):
    cmd = ["vol", "-f", memfile, "windows.netscan"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    rows = []
    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 6 and parts[0][0].isdigit():
            pid = parts[5] if parts[5].isdigit() else None
            state = parts[4] if len(parts) > 4 else None
            proc = parts[6] if len(parts) > 6 else None
            rows.append({"offset": parts[0], "proto": parts[1], "local": parts[2], "foreign": parts[3], "state": state, "pid": pid, "process": proc})
            if pid is not None and proc is not None:
                lname = proc.lower()
                if state == "SYN_SENT" and lname not in browser_names:
                    sus.append({"pid": int(pid), "ppid": None, "name": proc, "reason": "nonbrowser_syn_sent"})
                if state == "ESTABLISHED" and lname in system_names:
                    sus.append({"pid": int(pid), "ppid": None, "name": proc, "reason": "system_established_network"})
    return pd.DataFrame(rows)


def malfind(memfile):
    cmd = ["vol", "-f", memfile, "windows.malfind"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    rows = []
    current_pid = None
    current_name = None
    current_addr = None
    current_protection = ""
    current_block = []

    for line in result.stdout.splitlines():
        line_strip = line.strip()
        m = re.match(r'^Process:\s+(\S+)\s+Pid:\s+(\d+)\s+Address:\s+(0x[0-9a-fA-F]+)$', line_strip)
        if m:
            current_name = m.group(1)
            current_pid = int(m.group(2))
            current_addr = m.group(3)
            current_protection = ""
            current_block = []
            continue

        if "Protection:" in line_strip:
            current_protection = line_strip

        if line_strip:
            current_block.append(line_strip)

        if current_pid is not None and current_name is not None and current_addr is not None:
            joined = "\n".join(current_block).lower()
            if "page_execute_readwrite" in current_protection.lower() and "mz" in joined:
                rows.append({
                    "pid": current_pid,
                    "name": current_name,
                    "address": current_addr,
                    "protection": current_protection,
                    "reason": "malfind_rwx_with_mz"
                })
                sus.append({
                    "pid": current_pid,
                    "ppid": None,
                    "name": current_name,
                    "reason": "malfind_rwx_with_mz"
                })

                current_pid = None
                current_name = None
                current_addr = None
                current_protection = ""
                current_block = []

    return pd.DataFrame(rows)


def save_csvs(ps_df, cl_df, ns_df, ml_df, outdir="."):
    ps_df.to_csv(f"{outdir}/pslist.csv", index=False)
    cl_df.to_csv(f"{outdir}/cmdline.csv", index=False)
    ns_df.to_csv(f"{outdir}/netscan.csv", index=False)
    ml_df.to_csv(f"{outdir}/malfind.csv", index=False)
    if sus:
        pd.DataFrame(sus).drop_duplicates().to_csv(f"{outdir}/sus.csv", index=False)
    if patterns:
        pd.DataFrame(patterns).drop_duplicates().to_csv(f"{outdir}/patterns.csv", index=False)


if __name__ == "__main__":
    memfile = "memdump.mem"
    ps_df = pslist(memfile)
    cl_df = cmdline(memfile)
    ns_df = netscan(memfile)
    ml_df = malfind(memfile)
    save_csvs(ps_df, cl_df, ns_df, ml_df, outdir=".")
    print(ps_df.head())
    print(pd.DataFrame(sus).drop_duplicates())