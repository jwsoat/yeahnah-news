import json, glob, sys
ok = True
for f in glob.glob('editions/[0-9]*.json'):
    d = json.load(open(f, encoding='utf-8'))
    if not d.get('stories'): ok=False; print('no stories:', f)
    if d.get('meta',{}).get('qa_verified') is not True: ok=False; print('not QA-verified:', f)
    ac = d.get('affiliate_cta',{})
    if ac.get('enabled') and not ac.get('disclosure'): ok=False; print('CTA missing disclosure:', f)
print('ALL VALID' if ok else 'HOLD - fix above')
sys.exit(0 if ok else 1)
