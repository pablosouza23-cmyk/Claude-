"""Renders the Lumora imagery: the hero before/after pair and the four work thumbnails.

Usage:  python3 lumora/tools/render_images.py [--preview] [--out DIR]   (requires numpy + Pillow)
Output: lumora/hero/after.jpg   - finished render, shown by default in the hero
        lumora/hero/before.jpg  - clay + construction-line study of the same scene,
                                  painted along the cursor trail by the liquid reveal
        lumora/work/*.jpg       - portfolio / carousel thumbnails

Everything is a small signed-distance-field raymarcher in numpy: analytic floor plane,
soft shadows, ambient occlusion, ACES tone mapping, supersampled then downscaled.
"""
import math
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
F = np.float32
PREVIEW = "--preview" in sys.argv
OUT = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else ROOT


# ---------------------------------------------------------------- helpers
def lin(h):
    c = np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], F) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(F)


def norm(v):
    return (v / np.linalg.norm(v, axis=-1, keepdims=True)).astype(F)


def rot(ax=0, ay=0, az=0):
    """Rotation (degrees). Returned matrix M maps world rows to local rows: local = world @ M."""
    a, b, c = (math.radians(x) for x in (ax, ay, az))
    rx = np.array([[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]])
    ry = np.array([[math.cos(b), 0, math.sin(b)], [0, 1, 0], [-math.sin(b), 0, math.cos(b)]])
    rz = np.array([[math.cos(c), -math.sin(c), 0], [math.sin(c), math.cos(c), 0], [0, 0, 1]])
    return (rz @ ry @ rx).astype(F)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- primitives
def sphere(c, r, mat, **tag):
    c = np.array(c, F)
    return dict(sdf=lambda p: np.linalg.norm(p - c, axis=1) - r, mat=mat,
                tag=dict(kind="sphere", c=c, r=r, **tag))


def rbox(c, b, r, mat, R=None, **tag):
    c, b = np.array(c, F), np.array(b, F)

    def f(p):
        q = p - c
        if R is not None:
            q = q @ R
        q = np.abs(q) - b
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0) - r
    return dict(sdf=f, mat=mat, tag=dict(kind="box", c=c, **tag))


def torus(c, R0, r, mat, R=None, **tag):
    c = np.array(c, F)

    def f(p):
        q = p - c
        if R is not None:
            q = q @ R
        xz = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2) - R0
        return np.sqrt(xz ** 2 + q[:, 1] ** 2) - r
    return dict(sdf=f, mat=mat, tag=dict(kind="torus", c=c, R0=R0, r=r, **tag))


def cyl(c, r, h, mat, rr=0.02, R=None, **tag):
    """Rounded cylinder along local y, radius r, half-height h."""
    c = np.array(c, F)

    def f(p):
        q = p - c
        if R is not None:
            q = q @ R
        dx = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2) - r + rr
        dy = np.abs(q[:, 1]) - h + rr
        return (np.minimum(np.maximum(dx, dy), 0)
                + np.sqrt(np.maximum(dx, 0) ** 2 + np.maximum(dy, 0) ** 2) - rr)
    return dict(sdf=f, mat=mat, tag=dict(kind="cyl", c=c, r=r, h=h, **tag))


def arch(c, w, h, d, mat, **tag):
    """A slab with a round top (a rounded 'tombstone' arch) facing +z."""
    c = np.array(c, F)

    def f(p):
        q = p - c
        # body: box from y=0..h-w, plus a cylinder cap of radius w along z
        qb = np.abs(q - np.array([0, (h - w) / 2, 0], F)) - np.array([w, (h - w) / 2, d], F)
        body = np.linalg.norm(np.maximum(qb, 0), axis=1) + np.minimum(qb.max(1), 0)
        qc = q - np.array([0, h - w, 0], F)
        dr = np.sqrt(qc[:, 0] ** 2 + qc[:, 1] ** 2) - w
        dz = np.abs(qc[:, 2]) - d
        cap = np.minimum(np.maximum(dr, dz), 0) + np.sqrt(np.maximum(dr, 0) ** 2 + np.maximum(dz, 0) ** 2)
        return np.minimum(body, cap) - 0.015
    return dict(sdf=f, mat=mat, tag=dict(kind="arch", c=c, **tag))


# ---------------------------------------------------------------- renderer
def render(scene, W, H, ss=1.5, chunk=700_000):
    objs, cam, env, mats = scene["objs"], scene["cam"], scene["env"], scene["mats"]
    Wr, Hr = int(W * ss), int(H * ss)
    ro = np.array(cam["pos"], F)
    fw = norm(np.array(cam["target"], F) - ro)
    rt = norm(np.cross(fw, np.array([0, 1, 0], F)))
    up = np.cross(rt, fw).astype(F)
    fl = 1 / math.tan(math.radians(cam["fov"]) / 2)
    L = norm(np.array(env["light"], F))
    KEY, SKY = lin(env["key"]) * env["key_i"], lin(env["sky"]) * env["sky_i"]
    floor_alb = lin(env["floor"])
    horizon = floor_alb * (KEY * max(L[1], 0) * 0.85 + SKY)
    top = lin(env["top"]) * env.get("top_i", 1.0)

    def bg(rd):
        k = smoothstep(-0.02, 0.55, rd[:, 1])[:, None]
        return horizon * (1 - k) + top * k

    def odist(p, ids=False):
        ds = np.stack([o["sdf"](p) for o in objs])
        if ids:
            i = ds.argmin(0)
            return ds[i, np.arange(ds.shape[1])], i
        return ds.min(0)

    def fdist(p):
        return np.minimum(odist(p), p[:, 1])

    N = Wr * Hr
    out_a = np.zeros((N, 3), F)   # finished render (linear)
    out_b = np.zeros((N, 3), F)   # clay render (linear)
    tbuf = np.full(N, np.inf, F)
    idb = np.full(N, -1, np.int16)  # -1 background, 0 floor, k+1 object
    pbuf = np.zeros((N, 3), F)

    ys, xs = np.divmod(np.arange(N), Wr)
    for s in range(0, N, chunk):
        e = min(N, s + chunk)
        u = ((xs[s:e] + 0.5) / Wr * 2 - 1) * (Wr / Hr)
        v = 1 - (ys[s:e] + 0.5) / Hr * 2
        rd = norm(fw * fl + u[:, None] * rt + v[:, None] * up)
        n_ = e - s
        tfl = np.where(rd[:, 1] < -1e-4, -ro[1] / np.minimum(rd[:, 1], -1e-4), np.inf).astype(F)
        tlim = np.minimum(tfl, 60)
        t = np.full(n_, 0.0, F)
        hit = np.zeros(n_, bool)
        act = np.arange(n_)
        for _ in range(200):
            p = ro + rd[act] * t[act, None]
            d = odist(p)
            h = d < 2e-4 + 3e-4 * t[act]
            hit[act[h]] = True
            nh = ~h
            t[act[nh]] += d[nh] * 0.95
            act = act[nh & (t[act] < tlim[act])]
            if act.size == 0:
                break
        hit &= t < tlim
        flo = ~hit & np.isfinite(tfl) & (tfl < 60)
        t = np.where(hit, t, np.where(flo, tfl, np.inf)).astype(F)
        geo = hit | flo
        gi = np.nonzero(geo)[0]

        col_a = bg(rd)
        col_b = bg(rd)
        p = ro + rd[gi] * t[gi, None]
        ids = np.zeros(gi.size, np.int16)
        oi = hit[gi]
        nrm = np.tile(np.array([0, 1, 0], F), (gi.size, 1))
        if oi.any():
            po = p[oi]
            _, k = odist(po, ids=True)
            ids[oi] = k + 1
            ex = 8e-4
            kk = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], F)
            nn = sum(kk[j] * odist(po + kk[j] * ex)[:, None] for j in range(4))
            nrm[oi] = norm(nn)

        # soft shadow toward the key light (objects only cast)
        sh = np.ones(gi.size, F)
        lit = (nrm @ L) > 0
        si = np.nonzero(lit)[0]
        sp = p[si] + nrm[si] * 0.003
        tt = np.full(si.size, 0.01, F)
        res = np.ones(si.size, F)
        a2 = np.arange(si.size)
        for _ in range(64):
            hh = odist(sp[a2] + L * tt[a2, None])
            res[a2] = np.minimum(res[a2], env.get("soft", 9) * hh / tt[a2])
            tt[a2] += np.clip(hh, 0.01, 0.35)
            a2 = a2[(res[a2] > 0.002) & (tt[a2] < 14)]
            if a2.size == 0:
                break
        res = np.clip(res, 0, 1)
        sh[si] = res * res * (3 - 2 * res)

        # ambient occlusion
        occ = np.zeros(gi.size, F)
        sca = 1.0
        for j in range(6):
            hr = 0.015 + 0.22 * j / 5
            dd = fdist(p + nrm * hr)
            occ += (hr - dd) * sca
            sca *= 0.82
        ao = np.clip(1 - 2.2 * occ, 0, 1)

        rdi = rd[gi]
        diff = np.clip(nrm @ L, 0, 1)
        amb = 0.55 + 0.45 * nrm[:, 1]
        bnc = np.clip(0.5 - 0.5 * nrm[:, 1], 0, 1)
        hv = norm(L - rdi)
        ndh = np.clip(np.sum(nrm * hv, 1), 0, 1)
        ndv = np.clip(-np.sum(nrm * rdi, 1), 0, 1)
        fres = (1 - ndv) ** 5
        refl = rdi - 2 * np.sum(rdi * nrm, 1)[:, None] * nrm

        alb = np.tile(floor_alb, (gi.size, 1))
        spc = np.full(gi.size, env.get("floor_spec", 0.0), F)
        shn = np.full(gi.size, 30.0, F)
        for k, o in enumerate(objs):
            m = ids == k + 1
            if m.any():
                mt = mats[o["mat"]]
                alb[m] = lin(mt[0])
                spc[m] = mt[1]
                shn[m] = mt[2]
        bounce = floor_alb * KEY * max(L[1], 0) * 0.35
        light = (KEY * (diff * sh)[:, None] + SKY * (amb * ao)[:, None]
                 + bounce * (bnc * ao)[:, None])
        spec = (ndh ** shn) * diff * sh * spc * (0.25 + 0.75 * fres)
        envr = bg(refl) * (spc * (0.02 + 0.32 * fres) * ao)[:, None]
        ca = alb * light + KEY * spec[:, None] * 1.2 + envr

        clay_alb = np.where(ids[:, None] > 0, lin(env.get("clay", "#c4c3c0")), lin(env.get("clay_floor", "#d2d1ce")))
        light_b = (KEY * (diff * (0.35 + 0.65 * sh))[:, None] * 0.9 + SKY * (amb * ao)[:, None] * 1.05
                   + bounce * (bnc * ao)[:, None])
        cb = clay_alb * light_b

        f0 = env.get("fog_start", float(np.linalg.norm(np.array(cam["target"], F) - ro)) + 1.5)
        fog = (1 - np.exp(-((np.maximum(t[gi] - f0, 0) * env.get("fog", 0.035)) ** 2)))[:, None]
        bgi = bg(rdi)
        col_a[gi] = ca * (1 - fog) + bgi * fog
        col_b[gi] = cb * (1 - fog) + bgi * fog

        out_a[s:e], out_b[s:e] = col_a, col_b
        tb = np.full(n_, np.inf, F)
        tb[gi] = t[gi]
        tbuf[s:e] = tb
        ib = np.full(n_, -1, np.int16)
        ib[gi] = ids
        idb[s:e] = ib
        pb = np.zeros((n_, 3), F)
        pb[gi] = p
        pbuf[s:e] = pb

    geo = dict(W=Wr, H=Hr, t=tbuf.reshape(Hr, Wr), id=idb.reshape(Hr, Wr), p=pbuf.reshape(Hr, Wr, 3),
               ro=ro, fw=fw, rt=rt, up=up, fl=fl)
    return out_a.reshape(Hr, Wr, 3), out_b.reshape(Hr, Wr, 3), geo


def tonemap(c, exposure):
    x = np.maximum(c * exposure, 0)
    y = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)
    y = np.clip(y, 0, 1)
    return np.where(y <= 0.0031308, y * 12.92, 1.055 * np.power(y, 1 / 2.4) - 0.055)


def to_img(srgb, W, H):
    im = Image.fromarray((np.clip(srgb, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")
    return im.resize((W, H), Image.LANCZOS) if im.size != (W, H) else im


def add_grain(im, amount=2.2, seed=7):
    a = np.asarray(im).astype(np.float32)
    rng = np.random.default_rng(seed)
    a += rng.normal(0, amount, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- the 'before' construction study
def lines_alpha(val, spacing, width_px, valid):
    """Screen-space anti-aliased iso-lines of `val` (2D), ~width_px wide wherever valid."""
    gy, gx = np.gradient(val)
    g = np.abs(gx) + np.abs(gy)
    g = np.where(valid, g, np.inf)
    d = np.abs((val / spacing + 0.5) % 1.0 - 0.5) * spacing
    a = np.clip(1 - d / np.maximum(g * width_px * 0.5, 1e-6), 0, 1)
    a *= np.clip(1.3 - g / (spacing * 0.3), 0, 1)  # fade where lines would crowd (moire)
    return np.where(valid, a, 0)


def construction(clay_lin, geo, ss, ink=(0.02, 0.02, 0.02)):
    ids, t, P = geo["id"], geo["t"], geo["p"]
    c = clay_lin.copy()
    # silhouettes / creases: id change (ignoring floor<->background) or depth jump
    edge = np.zeros(ids.shape, F)
    for ax in (0, 1):
        a, b = ids, np.roll(ids, -1, axis=ax)
        ta, tb = t, np.roll(t, -1, axis=ax)
        both_bg = (a <= 0) & (b <= 0)
        jump = (a != b) & ~both_bg
        fin = np.isfinite(ta) & np.isfinite(tb)
        same = (a == b) & (a > 0) & fin & (np.abs(np.where(fin, ta - tb, 0)) > 0.04 * np.where(fin, np.minimum(ta, tb), 1))
        e = (jump | same).astype(F)
        edge = np.maximum(edge, e)
        edge = np.maximum(edge, np.roll(e, 1, axis=ax))
    # widen a touch relative to supersampling
    if ss > 1.2:
        edge = np.maximum.reduce([edge, np.roll(edge, 1, 0), np.roll(edge, 1, 1)])
    obj = ids > 0
    flo = ids == 0
    sl = lines_alpha(P[..., 1], 0.07, 1.1 * ss, obj) * 0.28
    gx = lines_alpha(P[..., 0], 0.25, 1.0 * ss, flo)
    gz = lines_alpha(P[..., 2], 0.25, 1.0 * ss, flo)
    gX = lines_alpha(P[..., 0], 1.0, 1.4 * ss, flo)
    gZ = lines_alpha(P[..., 2], 1.0, 1.4 * ss, flo)
    fade = np.exp(-np.where(flo, t, 99) * 0.07)
    grid = np.maximum(np.maximum(gx, gz) * 0.13, np.maximum(gX, gZ) * 0.3) * fade
    a = np.clip(np.maximum.reduce([edge * 0.82, sl, grid]), 0, 1)[..., None]
    return c * (1 - a) + np.array(ink, F) * a


def project(geo, pt, H):
    """World point -> (x, y, depth) in final image pixels (H = final height)."""
    d = np.array(pt, F) - geo["ro"]
    z = float(d @ geo["fw"])
    x = float(d @ geo["rt"]) / z * geo["fl"]
    y = float(d @ geo["up"]) / z * geo["fl"]
    W = H * geo["W"] / geo["H"]
    return (x / (W / H) + 1) / 2 * W, (1 - y) / 2 * H, z


def annotate(im, scene, geo, accent="#b15f2c", ink="#1b1b1b"):
    W, H = im.size
    dr = ImageDraw.Draw(im, "RGBA")
    fs = max(14, int(H * 0.0135))
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", fs)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", int(fs * 0.85))
    lw = max(1, round(H / 900))
    acc = tuple(int(accent[i:i + 2], 16) for i in (1, 3, 5)) + (235,)
    ik = tuple(int(ink[i:i + 2], 16) for i in (1, 3, 5)) + (200,)

    def dashed_circle(cx, cy, r, col, dash=7):
        n = max(24, int(2 * math.pi * r / (dash * 2)))
        for i in range(n):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 0.5) / n
            dr.arc([cx - r, cy - r, cx + r, cy + r], math.degrees(a0), math.degrees(a1), fill=col, width=lw)

    def cross(x, y, s, col):
        dr.line([x - s, y, x + s, y], fill=col, width=lw)
        dr.line([x, y - s, x, y + s], fill=col, width=lw)

    def label(x, y, text, col=ik, f=font):
        dr.text((x, y), text, fill=col, font=f)

    for o in scene["objs"]:
        tg = o["tag"]
        if tg.get("note") is None:
            continue
        cx, cy, z = project(geo, tg["c"], H)
        if tg["kind"] == "sphere":
            r = tg["r"] * geo["fl"] * H / 2 / z
            dashed_circle(cx, cy, r * 1.0, acc)
            dashed_circle(cx, cy, r * 1.16, acc[:3] + (110,), dash=4)
            cross(cx, cy, r * 1.32, acc[:3] + (150,))
            dr.ellipse([cx - 3 * lw, cy - 3 * lw, cx + 3 * lw, cy + 3 * lw], fill=acc)
            # dimension line under the sphere
            y0 = cy + r * 1.28
            dr.line([cx - r, y0, cx + r, y0], fill=ik, width=lw)
            for xx in (cx - r, cx + r):
                dr.line([xx, y0 - 6 * lw, xx, y0 + 6 * lw], fill=ik, width=lw)
            tw = dr.textlength(tg["note"], font=font)
            dr.rectangle([cx - tw / 2 - 6, y0 + 8, cx + tw / 2 + 6, y0 + 10 + fs * 1.25], fill=(236, 235, 232, 230))
            label(cx - tw / 2, y0 + 9, tg["note"])
        else:
            cx, cy, _ = project(geo, tg.get("at", tg["c"]), H)
            cross(cx, cy, fs * 1.1, acc)
            left = tg.get("side") == "left"
            tx = cx - fs * 1.4 - dr.textlength(tg["note"], font=font) if left else cx + fs * 1.4
            label(tx, cy - fs * 1.6, tg["note"], acc)
            if tg.get("sub"):
                label(tx, cy - fs * 0.4, tg["sub"], ik, small)
    return im


# ---------------------------------------------------------------- scenes
MATS = {
    "chalk": ("#ecebe8", 0.25, 40.0),
    "bone": ("#dcd9d3", 0.18, 30.0),
    "accent": ("#a8501c", 0.45, 60.0),
    "rust": ("#7a3c14", 0.35, 50.0),
    "ink": ("#0c0c0c", 0.55, 90.0),
    "stone": ("#bdbcb8", 0.15, 24.0),
    "graphite": ("#2e2e2e", 0.45, 70.0),
    "sage": ("#a9b0a3", 0.2, 30.0),
    "sand": ("#d8ccb8", 0.15, 24.0),
}

HERO = dict(
    cam=dict(pos=(-0.6, 1.55, 7.4), target=(0.55, 0.85, 0.0), fov=31),
    env=dict(light=(-0.55, 0.85, 0.55), key="#fff4e6", key_i=1.8, sky="#dfe3e8", sky_i=0.56,
             floor="#c4c3c0", top="#e6e5e3", top_i=0.74, fog=0.045, soft=7,
             clay="#c7c6c3", clay_floor="#d4d3d0"),
    mats=MATS,
    objs=[
        arch((2.05, 0.0, -1.55), 0.82, 2.65, 0.16, "bone", note="ARCH 1.64 × 2.65", sub="slab · t 0.32", at=(2.05, 2.65, -1.39)),
        sphere((1.05, 0.86, 0.15), 0.86, "chalk", note="Ø 1.72 · CHALK"),
        sphere((2.55, 0.36, 1.05), 0.36, "accent", note="Ø 0.72 · #B15F2C"),
        torus((3.35, 0.66, -0.15), 0.52, 0.13, "ink", R=rot(0, -28, 90), note="TORUS · INK", sub="R0.52 / r0.13", at=(3.35, 1.18, -0.15), side="left"),
    ],
)

WORK = {
    "northwind": dict(
        cam=dict(pos=(0.0, 1.4, 6.2), target=(0.0, 0.8, 0.0), fov=30),
        env=dict(light=(-0.6, 0.8, 0.5), key="#fff1e2", key_i=1.8, sky="#f3d2bc", sky_i=0.5,
                 floor="#9a5a39", top="#ad6a45", top_i=0.7, fog=0.05, soft=8),
        mats=dict(MATS, warm=("#a65f3a", 0.3, 40.0), cream=("#f1e6d8", 0.3, 50.0)),
        objs=[
            arch((0.0, 0.0, -1.2), 1.0, 2.9, 0.18, "warm"),
            sphere((-0.15, 0.7, 0.4), 0.7, "cream"),
            sphere((1.05, 0.28, 0.95), 0.28, "rust"),
        ],
    ),
    "halcyon": dict(
        cam=dict(pos=(2.2, 2.4, 6.0), target=(0.0, 0.7, 0.0), fov=30),
        env=dict(light=(-0.5, 0.9, 0.35), key="#fbfbf6", key_i=2.1, sky="#dfe6e2", sky_i=0.65,
                 floor="#b9bfb6", top="#e3e7e2", top_i=0.85, fog=0.04, soft=10),
        mats=MATS,
        objs=[
            rbox((-0.35, 0.09, 0.2), (0.62, 0.07, 1.15), 0.06, "chalk", R=rot(0, 18, 0)),
            rbox((-0.25, 0.27, 0.12), (0.6, 0.07, 1.1), 0.06, "sage", R=rot(0, 8, 0)),
            rbox((-0.2, 0.45, 0.05), (0.58, 0.07, 1.05), 0.06, "graphite", R=rot(0, -4, 0)),
            torus((1.2, 0.5, 0.65), 0.38, 0.11, "accent", R=rot(0, 20, 90)),
            sphere((-1.45, 0.3, 1.0), 0.3, "chalk"),
        ],
    ),
    "atlas": dict(
        cam=dict(pos=(0.3, 3.5, 6.9), target=(0.0, 0.3, 0.0), fov=32),
        env=dict(light=(-0.45, 0.85, 0.3), key="#ffffff", key_i=1.9, sky="#7e8288", sky_i=0.35,
                 floor="#1c1c1c", top="#141414", top_i=1.0, fog=0.05, soft=12, floor_spec=0.1),
        mats=MATS,
        objs=[
            *[rbox((-1.5 + 1.0 * i, 0.3 + (0.25 if (i + j) % 3 == 0 else 0) * 0, -1.0 + 1.0 * j),
                   (0.36, 0.3 + (0.22 if (i * 7 + j * 3) % 4 == 0 else 0), 0.36), 0.04,
                   "chalk" if (i + j) % 4 else "accent")
              for i in range(4) for j in range(3) if not (i == 2 and j == 2)],
            sphere((0.5, 0.36, 1.0), 0.36, "chalk"),
        ],
    ),
    "ferro": dict(
        cam=dict(pos=(-0.6, 1.3, 6.0), target=(0.2, 0.75, 0.0), fov=30),
        env=dict(light=(-0.6, 0.75, 0.6), key="#fff3e3", key_i=2.1, sky="#e8dccb", sky_i=0.6,
                 floor="#cdbfa9", top="#e6dccd", top_i=0.85, fog=0.045, soft=7),
        mats=MATS,
        objs=[
            cyl((-0.75, 0.85, -0.2), 0.36, 0.85, "ink", rr=0.08),
            cyl((0.15, 0.6, 0.2), 0.32, 0.6, "accent", rr=0.08),
            cyl((0.95, 0.45, -0.35), 0.3, 0.45, "chalk", rr=0.08),
            sphere((1.4, 0.24, 0.75), 0.24, "rust"),
            rbox((-1.7, 0.18, 0.55), (0.34, 0.18, 0.34), 0.04, "sand", R=rot(0, 24, 0)),
        ],
    ),
}


def main():
    (OUT / "hero").mkdir(parents=True, exist_ok=True)
    (OUT / "work").mkdir(parents=True, exist_ok=True)
    scale = 0.25 if PREVIEW else 1.0
    ss = 1.0 if PREVIEW else 1.5

    t0 = time.time()
    W, H = int(2400 * scale), int(1500 * scale)
    a, b, geo = render(HERO, W, H, ss=ss)
    after = to_img(tonemap(a, 1.0), W, H)
    b = construction(b, geo, ss)
    before = to_img(tonemap(b, 1.0), W, H)
    before = annotate(before, HERO, geo)
    add_grain(after, 1.6).save(OUT / "hero/after.jpg", quality=84, optimize=True, progressive=True)
    add_grain(before, 1.6, 9).save(OUT / "hero/before.jpg", quality=84, optimize=True, progressive=True)
    print(f"hero {W}x{H} in {time.time() - t0:.1f}s")

    for name, sc in WORK.items():
        t0 = time.time()
        W, H = int(1600 * scale), int(1200 * scale)
        a, _, _ = render(sc, W, H, ss=ss)
        im = to_img(tonemap(a, 1.0), W, H)
        add_grain(im, 1.8).save(OUT / f"work/{name}.jpg", quality=82, optimize=True, progressive=True)
        print(f"{name} {W}x{H} in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
