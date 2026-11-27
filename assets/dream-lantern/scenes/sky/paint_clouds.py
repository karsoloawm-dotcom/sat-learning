"""Render the original cloud atlas. Requires Python, NumPy, SciPy and Pillow."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, shift, zoom


def wash(rng, shape, spacing):
    low = tuple(max(4, round(size / spacing) + 1) for size in shape)
    lattice = rng.standard_normal(low).astype("f")
    return zoom(lattice, np.divide(shape, low), order=2, prefilter=True)


def cloud(seed, tower=False, underlit=False):
    """Sculpt a density field, march towards the sun, then paint through the field."""
    rng = np.random.default_rng(seed)
    nz, ny, nx = shape = (67, 202, 360)
    masses = []
    for u in np.linspace(-1, 1, 10):
        bump = 1 - u * u
        x, y = 180 + 146 * u, 128 - bump * (41 if tower else 15) + rng.normal(0, 5)
        radius = (15 + 28 * bump) * rng.uniform(.84, 1.12)
        masses.append((x, y, 31 + rng.uniform(-5, 5), radius * 1.32,
                       radius * (1.13 if tower else .73), radius * .60))
    if tower:
        masses.extend([(184, 71, 28, 47, 44, 26), (208, 62, 32, 30, 30, 17)])
    for x, y, z, rx, ry, rz in list(masses):
        for _ in range(7):
            a = rng.uniform(-2.9, 2.9)
            k = rng.uniform(.31, .61)
            masses.append((x + rx * .75 * np.cos(a), y + ry * .74 * np.sin(a),
                           z + rz * rng.uniform(-.77, .40), rx * k, ry * k, rz * k))
    field = np.full(shape, -18., dtype="f")
    for cx, cy, cz, rx, ry, rz in masses:
        region = tuple(slice(max(0, int(c - r - 12)), min(n, int(c + r + 13)))
                       for c, r, n in ((cz, rz, nz), (cy, ry, ny), (cx, rx, nx)))
        zz, yy, xx = np.ogrid[region]
        d = 1 - np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 + ((zz - cz) / rz) ** 2)
        field[region] = np.maximum(field[region], d * min(rx, ry, rz))
    for size, weight in [(25, 3.8), (11, 2.1), (5, .98), (2.5, .5)]:
        field += wash(rng, shape, size) * weight
    density = np.clip((field + .85) * .29, 0, 1)
    sun_y = .65 if underlit else -.77
    # Optical depth towards a grazing sun. Integrating thickness (rather than a
    # surface normal) lets the light penetrate edges and neighbouring lobes.
    depth = np.zeros_like(field)
    for distance, step in [(1, 2), (4, 3), (8, 4), (13, 5), (20, 8), (31, 12), (46, 14)]:
        delta = (round(.40 * distance), round(-sun_y * distance), round(.70 * distance))
        depth += shift(density, delta, order=0, mode="constant", prefilter=False) * step
    light = .11 + .76 * np.exp(-depth * .073) + .13 * np.exp(-depth * .014)
    light += .035 * wash(rng, shape, 18)
    pigment = np.zeros((ny, nx), dtype="f")
    transmittance = np.ones_like(pigment)
    for d, lum in zip(density, light):
        absorb = 1 - np.exp(-d * .59)
        pigment += transmittance * absorb * lum
        transmittance *= 1 - absorb
    alpha = 1 - transmittance
    pigment /= np.maximum(alpha, 1e-6)
    pigment = .56 * pigment + .44 * np.round(pigment * 11) / 11
    gray = np.uint8(np.clip(pigment, 0, 1) * 255)
    return Image.fromarray(np.dstack((gray, gray, gray, np.uint8(alpha * 255)))).resize(
        (640, 352), Image.Resampling.BICUBIC)


def deck(tiles):
    """A continuous deck underneath the moving cloud towers, fading into mist."""
    rng = np.random.default_rng(461)
    w, h = 960, 320
    y, x = np.indices((h, w))
    floor = 96 + 24 * (1 - y / h) + 7 * np.sin(x / 88 + y / 27)
    canvas = Image.fromarray(np.uint8(floor)).convert("RGBA")
    for v in np.linspace(.015, 1.27, 28):
        size = int(14 + v ** 1.35 * 238)
        for j in range(-1, w // size * 2 + 3):
            tile = tiles[rng.integers(0, 2)]
            if j % 2:
                tile = tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            sw = int(size * rng.uniform(1.1, 1.8))
            sh = int(size * rng.uniform(.24, .40))
            stamp = tile.resize((sw, max(2, sh)), Image.Resampling.LANCZOS)
            canvas.alpha_composite(stamp, (int((j + rng.random() * .8) * size / 2),
                                           int(v * h - sh * .65 + rng.random() * size * .08)))
    return canvas


if __name__ == "__main__":
    folder = Path(__file__).parent
    stamps = [cloud(301, underlit=True), cloud(742), cloud(931, tower=True)]
    sheet = Image.new("RGBA", (640, 1056))
    for i, tile in enumerate(stamps):
        sheet.paste(tile, (0, 352 * i))
    sheet.save(folder / "cloud-relief.webp", quality=90, method=6)
    deck(stamps).convert("RGB").save(folder / "cloud-deck.webp", quality=89, method=6)

