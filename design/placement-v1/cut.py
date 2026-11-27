# 纯绿底犀鸟姿势图 → 透明底、按连通块分成三张、去绿边、缩小、转 webp（WSL：python3 design/placement-v1/cut.py）
#   三个姿势横向范围会交叠（扒卡那只的爪子伸到拿地图那只的尾巴上方），所以按「连通块」分组，不按列切
import os, subprocess
from collections import deque
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../../miniprogram/miniprogram/pkg-word/placement/img')
os.makedirs(OUT, exist_ok=True)
im = Image.open(os.path.join(HERE, 'poses-green.png')).convert('RGBA')
W, H = im.size
px = im.load()

# 1. 抠绿：绿色远多于红蓝的算背景；边缘按「绿多出来多少」给半透明，并把残留的绿压下去（去绿边）
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        m = max(r, b)
        d = g - m
        if d > 90:
            px[x, y] = (0, 0, 0, 0)
        elif d > 25:
            px[x, y] = (r, min(g, m), b, int(255 * (90 - d) / 65))
        elif g > m:
            px[x, y] = (r, min(g, m + 8), b, a)

# 2. 缩小 4 倍的掩码上找连通块（细线只有 1–2px 高，缩小后多半断开；再去掉太扁的块）
S = 4
w, h = W // S, H // S
mask = [[px[x * S + S // 2, y * S + S // 2][3] > 60 for x in range(w)] for y in range(h)]
label = [[0] * w for _ in range(h)]
comps = []
for y in range(h):
    for x in range(w):
        if mask[y][x] and not label[y][x]:
            n = len(comps) + 1
            q = deque([(x, y)]); label[y][x] = n
            xs, ys, cnt = [x, x], [y, y], 0
            while q:
                cx, cy = q.popleft(); cnt += 1
                xs = [min(xs[0], cx), max(xs[1], cx)]; ys = [min(ys[0], cy), max(ys[1], cy)]
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not label[ny][nx]:
                        label[ny][nx] = n; q.append((nx, ny))
            comps.append({'n': n, 'cnt': cnt, 'x': xs, 'y': ys})
# 3. 按位置分组：左 / 中 / 右三只；太小或太扁（细线）的块丢掉
names = ['bird-map', 'bird-peek', 'bird-jump']
def group(c):
    if c['cnt'] < 30 or (c['y'][1] - c['y'][0]) < 4: return None
    cx = (c['x'][0] + c['x'][1]) / 2 / w
    return 0 if cx < 0.34 else 1 if cx < 0.64 else 2
gid = {c['n']: group(c) for c in comps}
print('components', [(c['n'], c['cnt'], gid[c['n']]) for c in comps if c['cnt'] >= 30])

for gi, name in enumerate(names):
    part = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    pp = part.load()
    for y in range(H):
        ly = min(y // S, h - 1)
        for x in range(W):
            if px[x, y][3] == 0: continue
            lx = min(x // S, w - 1)
            # 这个像素属于哪一块：取附近 3×3 里第一个有标号的格子（边缘半透明像素在掩码外）
            g = None
            for dy in (0, -1, 1):
                for dx in (0, -1, 1):
                    yy, xx = ly + dy, lx + dx
                    if 0 <= yy < h and 0 <= xx < w and label[yy][xx]:
                        g = gid[label[yy][xx]]; break
                if g is not None: break
            if g == gi: pp[x, y] = px[x, y]
    part = part.crop(part.getbbox())
    th = 360 if name != 'bird-peek' else 220
    part = part.resize((round(part.width * th / part.height), th), Image.LANCZOS)
    png = os.path.join(HERE, name + '.png')
    part.save(png)
    webp = os.path.join(OUT, name + '.webp')
    subprocess.run(['cwebp', '-quiet', '-q', '82', '-alpha_q', '90', png, '-o', webp], check=True)
    print(name, part.size, os.path.getsize(webp) // 1024, 'KB')
