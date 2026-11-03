# 5000 高频词词库:启航的 xlsx(逐义项)+ 音频改号表 → words.json
# 用法:python3 build.py   (需要 openpyxl)
#
# 排序用音频包的新序号(new_rank):1–3027 正好是 xlsx 里审过的词,按 xlsx 顺序排;
# 3028–5000 只有音频还没有释义,状态 pending,不出现在学习里,等启航给完整表再补。
# xlsx 里标了「AI生成，建议复核」的义项单独记 check=true,学生端不显示;一个词的义项全是这种就整个词 pending。
import csv, json, re, sys
from pathlib import Path
import openpyxl

HERE = Path(__file__).parent
SRC = HERE / 'source'
LEVEL_SIZE = 500

def norm(w):
    return re.sub(r'[^a-z]', '', w.lower())

mapping = list(csv.DictReader(open(SRC / 'renumber_mapping.csv', encoding='utf-8-sig')))
by_old = {int(r['old_rank']): r for r in mapping if r['source'] == 'excel_first_sheet'}

wb = openpyxl.load_workbook(SRC / '马来语高频词前3401.xlsx', read_only=True)
rows = [r for r in wb['逐义项导入'].iter_rows(min_row=2, values_only=True) if r[0]]

senses = {}  # new_rank -> (ms, root, [sense])
problems = []
for old, word, _no, pos, zh, ex_ms, ex_zh, flag in rows:
    m = re.match(r'^(.*?)\s*[（(]\s*(.*?)\s*[)）]\s*$', str(word).strip())
    ms, root = (m.group(1), m.group(2)) if m else (str(word or '').strip(), '')
    a = by_old.get(int(old))
    if not a:
        problems.append(f'没有音频对应:{old} {word}'); continue
    if not ms: ms = a['word']
    elif norm(a['word']) != norm(ms):
        problems.append(f'词和音频名不一致(按序号对上):{old} {ms} ↔ {a["word"]}')
    rank = int(a['new_rank'])
    e = senses.setdefault(rank, {'ms': ms, 'root': root, 'senses': []})
    s = {'pos': (pos or '').strip(), 'zh': (zh or '').strip(), 'exMs': (ex_ms or '').strip(), 'exZh': (ex_zh or '').strip()}
    if flag: s['check'] = True
    e['senses'].append(s)

words = []
for r in sorted(mapping, key=lambda r: int(r['new_rank'])):
    rank = int(r['new_rank'])
    e = senses.get(rank)
    if e:
        ok = [s for s in e['senses'] if not s.get('check')]
        status = 'approved' if ok else 'pending'
        w = {'rank': rank, 'ms': e['ms'], 'root': e['root'], 'senses': e['senses'], 'status': status}
    else:
        w = {'rank': rank, 'ms': r['word'], 'root': '', 'senses': [], 'status': 'pending'}
    w['level'] = (rank - 1) // LEVEL_SIZE + 1
    w['audio'] = r['new_audio_file']
    words.append(w)

(HERE / 'words.json').write_text(json.dumps(words, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

approved = sum(w['status'] == 'approved' for w in words)
print(f'共 {len(words)} 词,可学 {approved},待补 {len(words) - approved}')
for p in problems: print('  ', p)
