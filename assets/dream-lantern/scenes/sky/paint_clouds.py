"""Paint the cloud relief atlas. Run with Python, NumPy, SciPy and Pillow."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates, shift


def paint(seed, tower=False, underlit=False):
    rng = np.random.default_rng(seed)
    h, w = 352, 640
    y, x = np.indices((h, w), dtype=float)

    def wash(scale):
        paper = rng.normal(size=(int(h / scale) + 4, int(w / scale) + 4))
        return map_coordinates(paper, (1 + y / scale, 1 + x / scale), order=3)

    def turbulence():
        return sum(wash(s) * a for s, a in ((55, 5.5), (19, 2.8), (7, 1.25), (3, .42)))

    sx, sy = x + turbulence(), y + turbulence()
    front = np.zeros_like(x) - 75
    silhouette = np.zeros_like(x) - 75
    masses = []
    for u in np.linspace(-1, 1, 11):
        arch = max(0, 1 - u * u)
        cx = w * (.5 + u * .38)
        cy = h * (.63 - arch * (.25 if tower else .09)) + rng.normal(0, 12)
        size = (30 + arch * 56) * rng.uniform(.76, 1.12)
        masses.append((cx, cy, size * 1.24, size * (.97 if tower else .66), rng.uniform(-16, 6)))
    if tower:
        masses.extend([(320, 115, 86, 78, -15), (360, 91, 51, 48, -1)])
    # Grow smaller turrets on the parent forms. Each has its own depth.
    for cx, cy, rx, ry, cz in list(masses):
        for _ in range(9):
            a, r = rng.uniform(0, 2 * np.pi), rng.uniform(.27, .55)
            masses.append((cx + np.cos(a) * rx * .77, cy + np.sin(a) * ry * .8,
                           rx * r, ry * r, cz + rx * rng.uniform(.15, .63)))
    fine = wash(18) * 1.8 + wash(5) * .38
    for cx, cy, rx, ry, cz in masses:
        d = 1 - ((sx - cx) / rx) ** 2 - ((sy - cy) / ry) ** 2
        silhouette = np.maximum(silhouette, d * min(rx, ry) * .5)
        cap = np.sqrt(np.maximum(d, 0)) * rx * .78 + cz
        front = np.maximum(front, np.where(d >= 0, cap, -75))

    height = gaussian_filter(front, 3.0) + fine
    dy, dx = np.gradient(height)
    sun_y = .70 if underlit else -.72
    normal_light = (.64 * dx + sun_y * -dy + .47) / np.sqrt(1 + dx * dx + dy * dy)
    # Cast short shadows from one tuft onto the next, then soften into pigment.
    shadow = np.zeros_like(x)
    for dist in (5, 12, 24, 42):
        occluder = shift(height, (-sun_y * dist, .64 * dist), order=1, mode="nearest")
        shadow = np.maximum(shadow, occluder - height - .5 * dist)
    light = .32 + .42 * normal_light + .0032 * np.clip(height, -40, 90)
    light -= .25 * (1 - np.exp(-gaussian_filter(shadow, 2) / 15))
    edge = np.clip(1 - np.maximum(silhouette, 0) / 11, 0, 1)
    light += .14 * edge * np.clip(normal_light + .32, 0, 1)
    light = np.clip(light + .012 * wash(9), .025, 1)
    # Broken gouache washes with a trace of the continuous modelling underneath.
    pigment = np.round(light * 15) / 15 * .46 + .54 * light
    alpha = np.clip((silhouette + 2.4) / 5.5, 0, 1)
    values = (pigment * 253).astype(np.uint8)
    return Image.fromarray(np.dstack([values, values, values, (alpha * 255).astype(np.uint8)]))


if __name__ == "__main__":
    sheet = Image.new("RGBA", (640, 1056))
    for i, tile in enumerate([paint(301, underlit=True), paint(742), paint(931, tower=True)]):
        sheet.paste(tile, (0, 352 * i))
    sheet.save(Path(__file__).with_name("cloud-relief.webp"), quality=88, method=6)
