"""Repaint the city's sky banks and wet lookout stone. Python, Pillow and NumPy."""
from pathlib import Path
from random import Random

import numpy as np
from PIL import Image, ImageDraw


OUT = Path(__file__).parent
rng = Random(4229)
noise_source = np.random.default_rng(2621)


def wash(w, h, cell):
    dots = noise_source.integers(0, 256, (max(3, h // cell), max(3, w // cell)), dtype=np.uint8)
    return np.asarray(Image.fromarray(dots).resize((w, h), Image.Resampling.BICUBIC)) / 255 - .5


def clouds():
    w, h = 1024, 384
    y, x = np.mgrid[:h, :w]
    rough = 20 * wash(w, h, 33) + 11 * wash(w, h, 12) + 4 * wash(w, h, 4)
    depth = np.full((h, w), -60.)
    light = np.zeros_like(depth)
    # Scalloped crowns built from overlapping lobes. Light grazes the upper right.
    for cx, cy, sx, sy in [(90, 205, 176, 56), (245, 263, 118, 47),
                            (400, 310, 110, 17), (690, 289, 181, 32),
                            (815, 208, 155, 72), (958, 145, 123, 85)]:
        for i in range(89):
            dx = rng.uniform(-1, 1)
            px = cx + dx * sx
            py = cy + dx * dx * sy + rng.uniform(-.48, .64) * sy
            r = rng.uniform(9, 44) * (.64 + .46 * (1 - abs(dx)))
            nx, ny = (x - px) / (r * 1.38), (y - py) / r
            d = (1 - np.sqrt(nx * nx + ny * ny)) * r + rough
            z = np.sqrt(np.maximum(0, 1 - nx * nx - ny * ny))
            lum = .46 + .24 * nx - .42 * ny + .1 * z + .2 * (cy - y) / sy
            # Softly mix the lobes into banks, retaining a few hard gouache edges.
            blend = np.clip((d - depth + 7) / 14, 0, 1)
            light += blend * (lum - light)
            depth = np.maximum(depth, d)
    fine = wash(w, h, 7) + .5 * wash(w, h, 3)
    val = np.clip(light + fine * .12, 0, 1)
    val = .8 * val + .2 * np.round(val * 7) / 7
    ends = np.clip(np.minimum(x, w-1-x)/92, 0, 1)
    fringe = np.clip((depth + 2) / 4, 0, 1)
    alpha = np.uint8(255 * fringe * ends)
    # A second, much higher layer. Drag the grain along the wind in individual strokes.
    silks = Image.new('RGBA', (w, h))
    brush = ImageDraw.Draw(silks)
    for i in range(740):
        sx = rng.uniform(-100,w); band = rng.choice([1, 2, 3])
        yy = 28 + band*21 + 24*np.sin(sx/177 + band) + rng.gauss(0, 5)
        length = rng.uniform(9, 104)
        points = [(sx+length*k/8, yy - 4*np.sin(k*.3) - length*k/8*.056) for k in range(9)]
        opacity = int(rng.uniform(9, 38)*max(0, min(1, sx/70, (w-sx)/70)))
        brush.line(points, fill=(167, 191, 215, opacity), width=1 if i%8 else 2)
    for name, stops in [
        ('day', ['889ab9', 'acbed8', 'dce2e4', 'fff6dd', 'fffcea']),
        ('night', ['111a36', '142841', '284d70', '5095ac', '8be0dc'])
    ]:
        ramp = np.array([list(bytes.fromhex(s)) for s in stops])
        rgb = np.stack([np.interp(val, np.linspace(0, 1, 5), ramp[:, c]) for c in range(3)], axis=2)
        bank = Image.fromarray(np.dstack((rgb.astype('uint8'), alpha)))
        Image.alpha_composite(silks, bank).save(OUT / f'cloud-{name}.webp', quality=83)


def lookout():
    w, h = 1024, 720
    y, x = np.mgrid[:h, :w]
    broad, grain = wash(w, h, 58), wash(w, h, 3)
    grit = broad * 22 + grain * 15 + wash(w, h, 13) * 13 + noise_source.normal(0, 2.4, (h, w))
    ground = np.array([125, 139, 151]) + grit[:, :, None] + (x / w - y / h)[:, :, None] * [28, 19, 12]
    stone = Image.fromarray(np.uint8(np.clip(ground, 0, 255)))
    pen = ImageDraw.Draw(stone)
    for row in range(-1, 6):
        yy = row * 155 + 19
        pen.line([(0, yy), (w, yy + 8)], fill='#647586', width=3)
        pen.line([(0, yy + 3), (w, yy + 11)], fill='#b5b6af', width=2)
        for col in range(-2, 5):
            xx = col * 331 + (row % 2) * 163
            pen.line([(xx, yy), (xx + 5, yy + 156)], fill='#74818b', width=3)
    mirror = Image.new('RGB', (w, h))
    pen = ImageDraw.Draw(mirror)
    for yy in range(h):
        a = np.clip((yy - 110) / 480, 0, 1)
        pen.line((0, yy, w, yy), fill=tuple((np.array([207, 226, 225]) * (1-a) + np.array([45, 139, 206]) * a).astype(int)))
    bank = Image.open(OUT / 'cloud-day.webp').resize((1050, 260)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    mirror.paste(bank, (-25, 280), bank)
    # Three reflected streets, progressively sharper and more colourful toward the viewer.
    for layer, (base, tall) in enumerate([(118, 118), (112, 165), (100, 224)]):
        xx = -25
        while xx < w:
            width = rng.randrange(12 + layer * 3, 31 + layer * 11)
            roof = int(base + rng.uniform(.36, 1) * tall)
            tone = rng.choice([(225, 212, 183), (176, 198, 203), (194, 183, 182), (150, 176, 191)])
            shade = tuple(c - 23 - 8 * layer for c in tone)
            pen.rectangle((xx, 0, xx + width, roof), fill=tone)
            pen.polygon([(xx, 0), (xx+width*.29, 0), (xx+width*.29, roof+3), (xx, roof)], fill=shade)
            pen.line((xx, roof, xx+width*.29, roof+3, xx+width, roof), fill='#f8dbac', width=2)
            for floor in range(base - 36, roof - 4, rng.choice([5, 8, 10])):
                for win in range(xx+3, xx+width-2, 6):
                    pen.rectangle((win, floor, win+3, floor+2), fill=rng.choice([shade, '#6689a2', '#d4cfc2']))
            if rng.random() < .48:
                pen.rectangle((xx+4, roof, xx+width*.55, roof+5), fill=shade)
                pen.line((xx+6, roof, xx+6, roof+rng.randrange(8, 22)), fill=shade)
            xx += width + rng.randrange(1, 5)
    # The bank and architecture refract together in small horizontal ripples.
    ripple = 3 * np.sin(y * .095 + x * .023) + 9 * wash(w, h, 9)
    reflection = np.asarray(mirror)[np.clip(y + ripple.astype(int), 0, h-1), x]
    radius = ((x-510)/489)**2 + ((y-349 + 35*np.sin(x*.013))/241)**2
    edge = (1 - radius) + .42 * broad + .15 * wash(w, h, 20) + .07 * grain
    damp = np.clip((edge + .19) * 10, 0, 1)[:, :, None]
    water = np.clip(edge * 37, 0, 1)[:, :, None]
    sill = np.asarray(stone) * (1 - damp * .32)
    rgb = sill * (1-water) + (.93 * reflection + [2, 4, 8] + grain[:, :, None]*3) * water
    rgb += (np.exp(-np.abs(edge - .012) * 99) * (18 + 12*np.sin(x*.032)))[:, :, None]
    stone = Image.fromarray(np.uint8(np.clip(rgb, 0, 255)))
    pen = ImageDraw.Draw(stone, 'RGBA')
    for cx, cy, size in [(270, 367, 24), (744, 292, 40), (627, 472, 12), (367, 503, 15)]:
        for r in [size, size*.74, size*.47]:
            bounds = (cx-r, cy-r*.33, cx+r, cy+r*.33)
            pen.arc(bounds, 5, 155, fill=(239, 249, 232, 145), width=2)
            pen.arc(bounds, 175, 345, fill=(62, 113, 158, 120), width=1)
    for i in range(300):
        xx, yy = rng.randrange(w), rng.randrange(h)
        if abs(edge[yy, xx]) < .13:
            pen.line((xx, yy, xx+rng.randrange(2, 11), yy), fill=(253, 238, 195, 150), width=1)
    for cx, cy, size in [(229, 550, 15), (728, 392, 9), (840, 137, 18), (95, 308, 10)]:
        pen.ellipse((cx-size*.7, cy, cx+size, cy+size*.62), fill=(53, 60, 61, 122))
        pen.pieslice((cx-size, cy-size*1.45, cx+size, cy+size*.5), 199, 341, fill='#dca350')
        pen.line((cx, cy-size*.45, cx+5, cy+5), fill='#745f4f', width=2)
    stone.save(OUT / 'lookout.webp', quality=86)


if __name__ == '__main__':
    clouds()
    lookout()
