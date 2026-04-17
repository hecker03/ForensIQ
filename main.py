import subprocess

MEMFILE = "memdump.mem"

notsvc = {"calc.exe", "notepad.exe", "cmd.exe", "powershell.exe"}
sus = []

def pslist(memfile, notsvc):
    cmd = ["vol", "-f", memfile, "windows.pslist"]
    result = subprocess.run(cmd, capture_output=True, text=True)

    rows = []
    pid_to_name = {}
    svchost_pids = set()

    for line in result.stdout.splitlines():
        parts = line.split()
        if parts and parts[0].isdigit():
            pid = int(parts[0])
            ppid = int(parts[1])
            name = parts[2]
            rows.append((pid, ppid, name))
            pid_to_name[pid] = name
            if name.lower() == "svchost.exe":
                svchost_pids.add(pid)

    for pid, ppid, name in rows:
        parent_name = pid_to_name.get(ppid, "").lower()
        if parent_name == "svchost.exe" and name.lower() in notsvc:
            sus.append((pid, ppid, name))

    return sus
