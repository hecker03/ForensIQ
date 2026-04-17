import subprocess

defaults = {"calc.exe", "notepad.exe", "cmd.exe", "powershell.exe"}
browser_names = {"chrome.exe", "msedge.exe", "firefox.exe", "iexplore.exe", "opera.exe", "brave.exe"}
system_names = {"winlogon.exe", "svchost.exe", "lsass.exe", "csrss.exe", "services.exe", "smss.exe"}

sus = []

def pslist(memfile, defaults):
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

    return sus

# def netstat:
#     pass
