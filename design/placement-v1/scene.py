# 场景图 → 小程序素材（WSL：python3 design/placement-v1/scene.py）
#   1. scene-intro.png：找出五块石板（亮、偏白的大块），按从下到上排序，打印每块石板顶面中心的百分比位置（页面把档位名叠在这里）
#   2. 两张图缩到 750 宽转 webp；星空底压暗一点，免得和词卡抢
import os, json, subprocess
from collections import deque
from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../../miniprogram/miniprogram/pkg-word/placement/img')

im = Image.open(os.path.join(HERE, 'scene-intro.png')).convert('RGB')
W, H = im.size
S = 4
sm = im.resize((W // S, H // S))
w, h = sm.size
px = sm.load()
def stone(p):
    r, g, b = p
    return r > 200 and g > 185 and b > 150 and (max(p) - min(p)) < 70   # 象牙白
seen = [[False] * w for _ in range(h)]
blobs = []
for y in range(h):
    for x in range(w):
        if seen[y][x] or not stone(px[x, y]): continue
        q = deque([(x, y)]); seen[y][x] = True; pts = []
        while q:
            cx, cy = q.popleft(); pts.append((cx, cy))
            for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and stone(px[nx, ny]):
                    seen[ny][nx] = True; q.append((nx, ny))
        if len(pts) > 200:
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            blobs.append({'n': len(pts), 'x0': min(xs), 'x1': max(xs), 'y0': min(ys), 'y1': max(ys)})
blobs = sorted(sorted(blobs, key=lambda b: -b['n'])[:5], key=lambda b: -b['y1'])   # 最大的 5 块，从下往上
pos = [{'x': round((b['x0'] + b['x1']) / 2 / w * 100, 1), 'y': round((b['y0'] + b['y1']) / 2 / h * 100, 1), 'w': round((b['x1'] - b['x0']) / w * 100, 1)} for b in blobs]
print('STONES', json.dumps(pos))

def webp(src, name, q, dim=1.0):
    img = Image.open(os.path.join(HERE, src)).convert('RGB')
    img = img.resize((750, round(img.height * 750 / img.width)), Image.LANCZOS)
    if dim != 1.0: img = ImageEnhance.Brightness(img).enhance(dim)
    tmp = os.path.join(HERE, name + '.tmp.png'); img.save(tmp)
    out = os.path.join(OUT, name + '.webp')
    subprocess.run(['cwebp', '-quiet', '-q', str(q), tmp, '-o', out], check=True); os.remove(tmp)
    print(name, img.size, os.path.getsize(out) // 1024, 'KB')
# 场景图：四边做真透明的羽化（椭圆渐隐），亮度压到和星空底一样，叠上去看不出方框
def feathered(src, name, q, dim):
    img = Image.open(os.path.join(HERE, src)).convert('RGB')
    img = img.resize((750, round(img.height * 750 / img.width)), Image.LANCZOS)
    img = ImageEnhance.Brightness(img).enhance(dim).convert('RGBA')
    W2, H2 = img.size
    a = Image.new('L', (W2, H2))
    ap = a.load()
    for y in range(H2):
        for x in range(W2):
            # 只羽化四边一窄条（左右 8%、上下 6%），石板都在里面不受影响
            fx = min(x / (W2 * .08), (W2 - 1 - x) / (W2 * .08), 1)
            fy = min(y / (H2 * .06), (H2 - 1 - y) / (H2 * .06), 1)
            f = max(0, min(fx, fy))
            ap[x, y] = int(255 * (f * f * (3 - 2 * f)))
    img.putalpha(a)
    tmp = os.path.join(HERE, name + '.tmp.png'); img.save(tmp)
    out = os.path.join(OUT, name + '.webp')
    subprocess.run(['cwebp', '-quiet', '-q', str(q), '-alpha_q', '80', tmp, '-o', out], check=True); os.remove(tmp)
    print(name, img.size, os.path.getsize(out) // 1024, 'KB')
feathered('scene-intro.png', 'scene', 78, 0.88)  # 文件名带版本号：开发者工具同名图片有缓存
webp('bg-stars.png', 'bg-stars', 70, dim=0.85)
