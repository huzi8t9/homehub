import ipaddress, socket, platform, subprocess, json, ssl, re
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import closing

PORTS = [80, 443, 554, 55443, 1883, 8008, 8009, 8080, 8443, 5357]
MAX_WORKERS = 32

def _get_default_net():
    try:
        with closing(socket.socket(socket.AF_INET, socket.SOCK_DGRAM)) as s:
            s.connect(("8.8.8.8",80)); ip = s.getsockname()[0]
        return ipaddress.ip_network(ip.rsplit(".",1)[0] + ".0/24", strict=False)
    except:
        return ipaddress.ip_network("192.168.1.0/24")

def _ping(ip, ms=800):
    sys = platform.system().lower()
    try:
        if "windows" in sys:
            return subprocess.run(["ping","-n","1","-w",str(ms),ip],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode==0
        sec = max(1, ms//1000)
        r = subprocess.run(["ping","-c","1","-W",str(sec),ip],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if r.returncode!=0 and sys=="darwin":
            r = subprocess.run(["ping","-c","1",ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return r.returncode==0
    except: return False

def _tcp_alive(ip):
    for p in (80,443):
        try:
            with closing(socket.create_connection((ip,p),timeout=0.8)): return True
        except: pass
    return False

def _scan_port(ip, port):
    try:
        with closing(socket.create_connection((ip,port),timeout=0.5)): return True
    except: return False

def _http_banner(ip, port=80):
    try:
        with closing(socket.create_connection((ip,port),timeout=1.0)) as s:
            s.sendall(f"GET / HTTP/1.1\r\nHost: {ip}\r\nConnection: close\r\n\r\n".encode())
            data=b""
            while True:
                chunk=s.recv(4096)
                if not chunk: break
                data+=chunk
                if len(data)>65536: break
        raw=data.decode(errors="ignore")
        headers,_,body = raw.partition("\r\n\r\n")
        server="-"
        for line in headers.split("\r\n"):
            if line.lower().startswith("server:"):
                server=line.split(":",1)[1].strip(); break
        title="-"
        low=body.lower(); a,b = low.find("<title>"), low.find("</title>")
        if a!=-1 and b!=-1 and b>a: title = body[a+7:b].strip()
        return {"server":server,"title":title}
    except: return None

def _yeelight_probe(ip):
    try:
        with closing(socket.create_connection((ip,55443),timeout=0.8)) as s:
            s.sendall(b'{"id":1,"method":"get_prop","params":["name","model","fw_ver","power","bright"]}\r\n')
            s.settimeout(0.8)
            data = s.recv(4096).decode(errors="ignore").strip()
            if data.startswith("{"):
                obj=json.loads(data); res=obj.get("result") or []
                return {"name": res[0] if len(res)>0 else None, "model": res[1] if len(res)>1 else None, "raw": data}
    except: pass
    return None

def _mac(ip):
    try:
        if "windows" in platform.system().lower():
            out = subprocess.check_output(["arp","-a",ip], text=True, errors="ignore")
            m = re.search(rf"{re.escape(ip)}\s+([0-9a-f\-]{{17}})", out, re.I)
            return m.group(1).replace("-",
":").lower() if m else None
        out = subprocess.check_output(["arp","-n",ip], text=True, errors="ignore")
        m = re.search(rf"{re.escape(ip)}\s+\S+\s+([0-9a-f:]{{17}})", out, re.I)
        return m.group(1).lower() if m else None
    except: return None

def _scan_host(ip: str):
    if not (_ping(ip) or _tcp_alive(ip)):
        return None
    open_ports = [p for p in PORTS if _scan_port(ip, p)]
    info = {"ip": ip, "hostname": None, "open_ports": open_ports}
    try:
        info["hostname"] = socket.gethostbyaddr(ip)[0]
    except:
        pass
    if 80 in open_ports:
        info["http"] = _http_banner(ip) or {}
    if 55443 in open_ports:
        y = _yeelight_probe(ip)
        if y:
            info["yeelight"] = y
    info["mac"] = _mac(ip)
    return info

def scan_subnet_once():
    net = _get_default_net()
    hosts = [str(h) for h in net.hosts()]
    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(_scan_host, ip): ip for ip in hosts}
        for future in as_completed(futures):
            try:
                info = future.result()
            except Exception:
                info = None
            if info:
                results.append(info)
    return results
