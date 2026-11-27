// The crater is the common landmark. Its shore, the leaning island pine and the
// lantern paper recur at different scales over the nine cuts.
const TAU = 2 * Math.PI;
const clamp = x => Math.max(0, Math.min(1, x));
function random(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function wash(g, x, y, rx, ry, color) {
  g.save();
  g.translate(x, y); g.scale(rx, ry);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, color); grad.addColorStop(1, 'transparent');
  g.fillStyle = grad; g.fillRect(-1, -1, 2, 2); g.restore();
}
function stroke(g, x, y, x1, y1, width, color) {
  g.lineWidth = width; g.strokeStyle = color;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
}
// A wind-cut pine, painted from the trunk outwards. Broken fans of needles
// leave small windows of sky between the tiers of the crown.
function paintPine(g, w, h) {
  g.scale(w / 620, h / 420);
  const rng = random(37);
  g.lineCap = 'round';
  function bough(x, y, dx, dy, thick, depth) {
    const bend = (rng() - .48) * .35;
    const mx = x + dx * .57 + dy * bend, my = y + dy * .58 - dx * bend;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, x + dx, y + dy);
    g.strokeStyle = '#293d42'; g.lineWidth = thick; g.stroke();
    g.strokeStyle = '#9d9481'; g.lineWidth = thick * .23; g.stroke();
    if (depth > 0) {
      const turn = (a, len, ex, ey, sw) => bough(ex, ey,
        (dx * Math.cos(a) - dy * Math.sin(a)) * len,
        (dx * Math.sin(a) + dy * Math.cos(a)) * len, thick * sw, depth - 1);
      turn((rng() - .52) * .8, .70, x + dx, y + dy, .68);
      const angle = (dx < 0 ? -1 : 1) * (-.52 - rng() * .56);
      turn(angle, .63, mx, my, .49);
    } else {
      const r = 13 + rng() * 14;
      for (let j = 0; j < 95; j++) {
        const a = rng() * TAU, d = Math.sqrt(rng());
        const px = x + dx + Math.cos(a) * d * r * 1.24, py = y + dy + Math.sin(a) * d * r * .45;
        const col = ['#29484b', '#3d5551', '#516c61', '#719180', '#98ab8e'][Math.min(4, Math.floor(rng() * 2.4 + (1 - Math.sin(a) * d) * 1.2))];
        stroke(g, px, py, px + 2 + rng() * 5, py - 2 - rng() * 4, 1.3 + rng() * 2.3, col);
      }
    }
  }
  bough(300, 390, -30, -92, 24, 2);
  bough(273, 303, 48, -66, 18, 3);
  bough(307, 259, 55, -27, 12, 3);
  bough(285, 284, -58, -19, 12, 3);
  bough(317, 240, -48, -41, 11, 3);
  bough(314, 239, 26, -64, 12, 3);
  bough(292, 322, -72, -12, 10, 3);
  for (let i = 0; i < 18; i++) {
    const x = 278 + rng() * 41;
    stroke(g, 298 + rng() * 6, 366, x, 392, 2 + rng() * 3, '#465155');
  }
}
// Painted needles on curved cedar limbs, with light only on the upper tips.
function cedar(g, x, ground, height, width, tone, light, rng) {
  const top = ground - height, lean = (rng() - .5) * width * .4;
  stroke(g, x, ground, x + lean, top, Math.max(.8, width * .038), tone);
  g.lineCap = 'round';
  for (let i = 0; i < 36; i++) {
    const p = (i + .3) / 38, y = top + p * height, base = x + lean * (1 - p);
    for (const side of [-1, 1]) {
      const reach = side * width * (.14 + p * .83) * (.32 + rng() * .60);
      const dip = height * (.02 + p * .08) * (.4 + rng() * .6);
      const tx = base + reach, ty = y + dip * .72;
      g.fillStyle = tone; g.beginPath(); g.moveTo(base, y - height * .027);
      g.quadraticCurveTo(base + reach * .55, y + dip, tx, ty);
      for (let n = 7; n >= 0; n--) {
        const u = n / 8, edge = y + dip * u + height * .024;
        g.lineTo(base + u * reach, edge + rng() * height * .02);
        g.lineTo(base + (u + .03) * reach, edge - height * .014);
      }
      g.fill();
      if (i % 2 === 0) stroke(g, tx, ty, tx - reach * .32, ty - height * .009, Math.max(.6, width * .008), light);
    }
  }
}
function paintForest(g, w, h) {
  const rng = random(425);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#496e81'); sky.addColorStop(.53, '#e9dea9'); sky.addColorStop(1, '#38514b');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  wash(g, w * .67, h * .27, w * .42, h * .64, '#fff4c8');
  for (let layer = 0; layer < 3; layer++) {
    const count = [38, 26, 19][layer], tone = ['#859d95','#536f68','#2d5149'][layer];
    for (let i = 0; i < count; i++) {
      const x = (i + rng()) / count, side = Math.min(1, Math.abs(x - .67) * 3);
      const height = h * (.32 + side * .28 + rng() * .24 + layer * .05);
      const y = h * (.79 + layer * .10);
      cedar(g, x * w, y, height, height * (.10 + rng() * .1), tone, ['#b4bdae','#8b9e7c','#889779'][layer], rng);
    }
  }
  for (const x of [-.02,.06,.13,.91,1.04]) {
    cedar(g, x*w, h*1.12, h*(1.20+rng()*.4), w*(.10+rng()*.08), '#213c38','#5e7253',rng);
  }
  // Translucent sun shafts in the gap in the canopy.
  for (let i=0; i<11; i++) {
    const x = (.62 + rng()*.09)*w, width = (.001+rng()*.013)*w;
    const gr=g.createLinearGradient(0,h*.12,0,h*.90);
    gr.addColorStop(0,'rgba(255,246,182,.13)'); gr.addColorStop(1,'rgba(255,235,173,0)');
    g.fillStyle=gr; g.beginPath();g.moveTo(x,0);g.lineTo(x+width,0);
    g.lineTo(x-w*.38+width*3,h);g.lineTo(x-w*.38,h);g.fill();
  }
}
function paintLeaves(g, w, h) {
  g.scale(w/480,h/300); const rng=random(16); g.lineCap='round';
  function twig(x,y,dx,dy,d) {
    const ex=x+dx, ey=y+dy;
    stroke(g,x,y,ex,ey,d*1.45+.6,'#2c4548');
    if(d) {
      twig(ex,ey,dx*.67+9,(dy+12)*.78,d-1);
      twig(x+dx*.57,y+dy*.57,dx*.35+3,dy*.40+26,d-1);
    }
    for(let i=0;i<7;i++){
      const u=rng(), px=x+dx*u, py=y+dy*u, lx=(rng()-.25)*23, ly=10+rng()*19;
      g.fillStyle=['#263e45','#39595d','#536f70','#6c8884'][Math.floor(rng()*4)];
      g.beginPath();g.moveTo(px,py);g.quadraticCurveTo(px+lx-8,py+ly*.5,px+lx,py+ly);
      g.quadraticCurveTo(px+lx+4,py+ly*.45,px,py);g.fill();
      stroke(g,px,py,px+lx*.72,py+ly*.8,.65,'#84978b');
    }
  }
  twig(-18,9,96,23,4); twig(-15,32,55,34,3);
}
function paintClouds(g,w,h) {
  // A seamless azimuth strip. Broad masses are built first; narrow strokes
  // skim their sunward edges. The same wash appears upside down in the lake.
  const rng=random(93); g.scale(w/1024,h/256);
  for(let i=0;i<88;i++) {
    const cx=rng()*1024, cy=63+rng()*176, size=9+rng()*38;
    for(let j=0;j<20;j++){
      const q=(rng()-.5)*2, x=cx+q*size*1.8, y=cy+q*3+(rng()-.5)*size*.25;
      const rx=(.15+rng()*.56)*size, ry=(.055+rng()*.16)*size*(1-Math.abs(q)*.55);
      g.fillStyle=j<12?'rgba(94,105,133,.19)':'rgba(220,227,219,.20)';
      for(const off of [-1024,0,1024]) {
        g.beginPath();g.ellipse(x+off,y+(j<12?2:-1),rx,ry,-.05,0,TAU);g.fill();
      }
    }
  }
}
