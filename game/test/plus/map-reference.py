# Read-only bridge for the node test: run the actual Python reference on stdin records.
import base64, importlib.util, json, sys
from pathlib import Path
root = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('geo_reference', root / 'decode/tools/geo.py')
geo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geo)
original_draw = geo.ImageDraw.Draw
results = []
for encoded in json.load(sys.stdin):
    raw = base64.b64decode(encoded)
    commands = []
    class Recorder:
        def __init__(self, image): self.draw = original_draw(image)
        def rectangle(self, rect, fill):
            commands.append({'op': 'rectangle', 'rect': rect, 'colour': fill})
            self.draw.rectangle(rect, fill=fill)
        def text(self, point, text, fill):
            commands.append({'op': 'text', 'point': point, 'text': text, 'colour': fill})
            # Raster comparisons omit glyphs only: browser and Pillow use different fonts.
        def line(self, line, fill, width):
            commands.append({'op': 'line', 'line': line, 'colour': fill, 'width': width})
            self.draw.line(line, fill=fill, width=width)
    geo.ImageDraw.Draw = Recorder
    image = geo.render(raw)
    results.append({'cells': list(geo.parse(raw).values()), 'commands': commands,
                    'rgb': base64.b64encode(image.tobytes()).decode('ascii')})
print(json.dumps(results))
