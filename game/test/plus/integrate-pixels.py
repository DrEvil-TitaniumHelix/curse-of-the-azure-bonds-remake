"""Strict RGB checks for the five sampled PASS row references (Pillow required)."""
import json
from pathlib import Path
from PIL import Image, ImageChops
ROOT = Path(__file__).resolve().parents[3]

def raster(path):
    image = Image.open(path).convert('RGB')
    if image.size == (640,400):
        small = image.resize((320,200),Image.Resampling.NEAREST)
        if small.resize(image.size,Image.Resampling.NEAREST).tobytes() != image.tobytes():
            raise ValueError(f'{path}: not an exact nearest-neighbour double')
        image = small
    if image.size != (320,200): raise ValueError(f'{path}: unexpected raster {image.size}')
    return image

count = 0
for run in ['GBP-INTEGRATE-LG1','GBP-INTEGRATE-SH1']:
    path = ROOT/'acceptance/reports/acc'/f'{run}.json'
    report = json.loads(path.read_text(encoding='utf-8'))
    for step in report['steps']:
        if not step.get('ref'): continue
        reference = ROOT/'acceptance/local/ref'/f"{step['ref']}.png"
        if not reference.exists(): reference = ROOT/'acceptance/ref'/f"{step['ref']}.png"
        difference = ImageChops.difference(raster(reference),raster(ROOT/'acceptance/local/acc'/run/step['file']))
        # Bytes are read only; never write source pixels or derived images.
        pixels = difference.tobytes()
        mismatch = sum(pixels[i:i+3] != b'\0\0\0' for i in range(0,len(pixels),3))
        step['mismatch_pixels'] = mismatch; count += 1
        print(run,step['ref'],mismatch)
        if mismatch: raise AssertionError(f"{step['ref']}: {mismatch} pixels differ")
    path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
assert count == 5
