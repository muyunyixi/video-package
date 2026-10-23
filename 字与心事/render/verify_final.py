"""Checks the deliverables: frames, the two films, loudness, the split zip (v4.5 by default; another version
through the environment, e.g. VER=5.1 FR=out/full51_all D=out/final51).
v5.1: also the colour tags (both films BT.709) and the 高清版's bitrate second by second (its peak).
usage: python3 verify_final.py [frames|films|zip|all]"""
import hashlib, json, os, subprocess, sys

Z = "/home/claude/zxs"
VER, NFRAMES = os.environ.get("VER", "4.5"), 2230
FR = os.environ.get("FR", f"{Z}/out/full45")
D = os.environ.get("D", f"{Z}/out/final45")
HQ = f"{D}/字与心事_高清版_v{VER}.mp4"
H265 = f"{D}/字与心事_H265_v{VER}.mp4"
what = sys.argv[1] if len(sys.argv) > 1 else "all"


def frames():
    from PIL import Image
    names = sorted(os.listdir(FR))
    want = [f"f_{i:05d}.jpg" for i in range(NFRAMES)]
    missing = sorted(set(want) - set(names))
    bad = []
    for n in names:
        try:
            im = Image.open(os.path.join(FR, n))
            im.load()
            if im.size != (1920, 1080):
                bad.append((n, im.size))
        except Exception as e:  # truncated by an interrupted write
            bad.append((n, str(e)[:60]))
    print(f"frames: {len(names)} on disk, missing {len(missing)} {missing[:10]}, unreadable {bad[:10]}")
    return not missing and not bad


def probe(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size,bit_rate:stream=codec_type,codec_name,duration,nb_frames,width,height,r_frame_rate,sample_rate,profile,codec_tag_string", "-of", "json", f], capture_output=True, text=True).stdout)
    return j


def films():
    ok = True
    for f in (HQ, H265):
        j = probe(f)
        size = int(j["format"]["size"])
        print(f"{os.path.basename(f)}: {size} B = {size / 2**20:.2f} MiB, {size / 1e6:.2f} MB, {int(j['format']['bit_rate']) / 1e6:.2f} Mbps, duration {float(j['format']['duration']):.3f} s")
        for s in j["streams"]:
            print("   ", {k: s.get(k) for k in ("codec_type", "codec_name", "profile", "codec_tag_string", "width", "height", "r_frame_rate", "nb_frames", "duration", "sample_rate")})
        c = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_space,color_primaries,color_transfer,color_range", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip()
        print("    colour (range, matrix, transfer, primaries):", c)
        if f == HQ:
            pk = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time,size", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.split()
            sec = {}
            for ln in pk:
                t, s = ln.split(",")[:2]
                sec[int(float(t))] = sec.get(int(float(t)), 0) + int(s)
            mb = [sec[k] * 8 / 1e6 for k in sorted(sec)]
            print(f"    video bitrate per second: max {max(mb):.1f} Mbps, seconds over 16: {sum(v > 16 for v in mb)} of {len(mb)}")
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
        tail = [ln.strip() for ln in r.splitlines() if ln.strip().startswith(("I:", "Peak:", "LRA:"))][-3:]
        print("    loudness:", " | ".join(tail))
        if f == H265 and size > 29.5 * 2**20:
            print("    !! H.265 over 29.5 MiB")
            ok = False
    return ok


def zipcheck():
    zd = f"{D}/hq_zip"
    parts = sorted(os.listdir(zd))
    print("volumes:", [(p, os.path.getsize(os.path.join(zd, p))) for p in parts])
    # a split zip's volumes concatenated (z01, z02, …, then .zip) form one archive whose single stored
    # entry is the mp4: extract it by reading the local header and compare with the original's MD5
    order = sorted([p for p in parts if not p.endswith(".zip")]) + [p for p in parts if p.endswith(".zip")]
    blob = b"".join(open(os.path.join(zd, p), "rb").read() for p in order)
    import struct
    i = blob.find(b"PK\x03\x04")
    _, ver, flag, meth, _, _, crc, csize, usize, nlen, xlen = struct.unpack("<IHHHHHIIIHH", blob[i:i + 30])
    name = blob[i + 30:i + 30 + nlen].decode("utf-8" if flag & 0x800 else "cp437")
    start = i + 30 + nlen + xlen
    if csize == 0xFFFFFFFF or csize == 0:  # zip64 or data descriptor: fall back to the original's size
        csize = os.path.getsize(HQ)
    data = blob[start:start + csize]
    h1 = hashlib.md5(data).hexdigest()
    h2 = hashlib.md5(open(HQ, "rb").read()).hexdigest()
    print(f"entry {name!r} method {meth} utf8 {bool(flag & 0x800)}; md5 from volumes {h1}; original {h2}; {'MATCH' if h1 == h2 else 'DIFFERENT'}")
    return h1 == h2


if what in ("frames", "all"):
    frames()
if what in ("films", "all"):
    films()
if what in ("zip", "all"):
    zipcheck()
