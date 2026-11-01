# Hero layer pipeline

Turns `udaipur_4k_no_title.png` into a clean background plate plus transparent cut-out layers.

```
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
curl -L -o sam_vit_b.pth https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
mkdir -p masks layers
.venv/bin/python segment.py        # SAM masks for every entry in elements.json
.venv/bin/python fix.py            # man/cyclist overlap: trim man, add cyclist's front wheel
.venv/bin/python fix_pair.py       # remove crosswalk patch between the two friends' legs
.venv/bin/python build_layers.py   # RGBA cut-outs (+ foot shadows / boat wakes) -> layers/
.venv/bin/python inpaint.py        # LaMa fill behind every layer -> plate.png
.venv/bin/python finalize_plate.py # redraw crosswalk stripes, rebuild lake rows -> plate_final.png
.venv/bin/python motion_map.py     # tree sway + water masks -> motion_map.png
.venv/bin/python export_web.py     # masters -> /art, WebP + layers.json -> /public/hero
```

Coordinates in `elements.json` and in `public/hero/layers.json` are pixels in the 3840×2160 original.
Masters live in `/art`; web copies (WebP, 4K and 2K) in `/public/hero`.
