const FORMAT_INFO = {
  landscape: { width: 1920, height: 1080, bandTop: 846, horizon: 228, ratio: '16:9' },
  square: { width: 1080, height: 1080, bandTop: 842, horizon: 190, ratio: '1:1' },
  portrait: { width: 1080, height: 1350, bandTop: 1060, horizon: 188, ratio: '4:5' },
};

const LAYOUTS = {
  landscape: {
    frames: [
      { x: 68, y: 292, w: 1218, h: 520 },
      { x: 1308, y: 292, w: 261, h: 249 },
      { x: 1591, y: 292, w: 261, h: 249 },
      { x: 1308, y: 563, w: 544, h: 249 },
    ],
  },
  square: {
    frames: [
      { x: 52, y: 204, w: 620, h: 382 },
      { x: 694, y: 204, w: 334, h: 290 },
      { x: 694, y: 516, w: 334, h: 296 },
      { x: 52, y: 608, w: 620, h: 204 },
    ],
  },
  portrait: {
    frames: [
      { x: 54, y: 202, w: 972, h: 536 },
      { x: 54, y: 760, w: 309, h: 274 },
      { x: 385, y: 760, w: 309, h: 274 },
      { x: 716, y: 760, w: 309, h: 274 },
    ],
  },
};

export const FORMATS = Object.fromEntries(
  Object.entries(FORMAT_INFO).map(([key, info]) => [
    key,
    {
      key,
      width: info.width,
      height: info.height,
      ratio: info.ratio,
      label: key === 'landscape' ? 'Landscape' : key === 'portrait' ? 'Portrait' : 'Square',
    },
  ]),
);

export const FRAME_ROLES = ['Hero', 'Frame 02', 'Frame 03', 'Frame 04'];

const GOLD = '#e8b45b';
const CREAM = '#fff9ec';
const NAVY = '#071426';
const INK = '#030812';

let grainPattern = null;
const sunSprites = new Map();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function getLayout(format) {
  const info = FORMAT_INFO[format] ?? FORMAT_INFO.square;
  const key = FORMAT_INFO[format] ? format : 'square';
  return {
    key,
    width: info.width,
    height: info.height,
    bandTop: info.bandTop,
    bandHeight: info.height - info.bandTop,
    horizon: info.horizon,
    frames: LAYOUTS[key].frames,
  };
}

export function cropMetrics(rect, frame, image) {
  if (!image) return null;
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return null;
  const base = frame.mode === 'fit'
    ? Math.min(rect.w / iw, rect.h / ih)
    : Math.max(rect.w / iw, rect.h / ih);
  const scale = base * clamp(frame.zoom || 1, 1, 4);
  const drawW = iw * scale;
  const drawH = ih * scale;
  const limitX = Math.max(0, (drawW - rect.w) / 2);
  const limitY = Math.max(0, (drawH - rect.h) / 2);
  return {
    drawW,
    drawH,
    limitX,
    limitY,
    x: rect.x + (rect.w - drawW) / 2 + clamp(frame.panX || 0, -1, 1) * limitX,
    y: rect.y + (rect.h - drawH) / 2 + clamp(frame.panY || 0, -1, 1) * limitY,
  };
}

export function frameAtPoint(layout, x, y) {
  for (let i = layout.frames.length - 1; i >= 0; i -= 1) {
    const f = layout.frames[i];
    if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return i;
  }
  return -1;
}

function getGrainPattern(ctx) {
  if (grainPattern) return grainPattern;
  const tile = document.createElement('canvas');
  tile.width = 180;
  tile.height = 180;
  const tctx = tile.getContext('2d');
  const image = tctx.createImageData(tile.width, tile.height);
  const random = mulberry32(94721);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = 70 + Math.floor(random() * 150);
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 80 + Math.floor(random() * 90);
  }
  tctx.putImageData(image, 0, 0);
  grainPattern = ctx.createPattern(tile, 'repeat');
  return grainPattern;
}

function getSunSprite(radius) {
  const size = Math.max(16, Math.ceil(radius * 2));
  if (sunSprites.has(size)) return sunSprites.get(size);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#ffe47a');
  gradient.addColorStop(0.48, '#ffc151');
  gradient.addColorStop(0.8, '#ff853e');
  gradient.addColorStop(1, '#ff5f55');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  const cuts = [
    [0.27, 0.022],
    [0.35, 0.028],
    [0.43, 0.034],
    [0.51, 0.04],
    [0.6, 0.045],
    [0.7, 0.052],
    [0.81, 0.06],
  ];
  for (const [start, height] of cuts) {
    ctx.fillRect(0, size * start, size, Math.max(2, size * height));
  }
  ctx.globalCompositeOperation = 'source-over';
  sunSprites.set(size, canvas);
  return canvas;
}

function paintSky(ctx, layout) {
  const gradient = ctx.createLinearGradient(0, 0, 0, layout.bandTop);
  gradient.addColorStop(0, '#150722');
  gradient.addColorStop(0.18, '#310b43');
  gradient.addColorStop(0.38, '#681050');
  gradient.addColorStop(0.55, '#b51f5c');
  gradient.addColorStop(0.7, '#ef4b49');
  gradient.addColorStop(0.82, '#ff8b48');
  gradient.addColorStop(0.92, '#ffc36d');
  gradient.addColorStop(1, '#ffdf9a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, layout.width, layout.bandTop);

  const horizonGlow = ctx.createRadialGradient(
    layout.width * 0.53,
    layout.horizon,
    0,
    layout.width * 0.53,
    layout.horizon,
    layout.width * 0.5,
  );
  horizonGlow.addColorStop(0, 'rgba(255, 221, 132, 0.58)');
  horizonGlow.addColorStop(0.35, 'rgba(255, 132, 91, 0.3)');
  horizonGlow.addColorStop(1, 'rgba(255, 87, 179, 0)');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, 0, layout.width, layout.bandTop);

  ctx.save();
  ctx.globalAlpha = 0.24;
  for (let i = 0; i < 6; i += 1) {
    const y = layout.horizon * (0.2 + i * 0.11);
    const band = ctx.createLinearGradient(0, y, layout.width, y + 20);
    band.addColorStop(0, 'rgba(94, 13, 86, 0)');
    band.addColorStop(0.3, i % 2 ? 'rgba(255, 79, 148, 0.42)' : 'rgba(75, 19, 103, 0.44)');
    band.addColorStop(0.7, 'rgba(255, 128, 94, 0.18)');
    band.addColorStop(1, 'rgba(255, 92, 76, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, y, layout.width, layout.height * 0.014);
  }
  ctx.restore();

  const bottomSky = ctx.createLinearGradient(0, layout.horizon, 0, layout.bandTop);
  bottomSky.addColorStop(0, 'rgba(255, 126, 80, 0)');
  bottomSky.addColorStop(1, 'rgba(31, 9, 43, 0.9)');
  ctx.fillStyle = bottomSky;
  ctx.fillRect(0, layout.horizon, layout.width, layout.bandTop - layout.horizon);
}

function paintSun(ctx, layout) {
  const radius = layout.height * (layout.key === 'landscape' ? 0.075 : 0.052);
  const cx = layout.width * (layout.key === 'landscape' ? 0.535 : 0.56);
  const cy = layout.horizon - radius * 0.58;
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius * 4.8);
  glow.addColorStop(0, 'rgba(255, 238, 156, 0.58)');
  glow.addColorStop(0.3, 'rgba(255, 162, 84, 0.26)');
  glow.addColorStop(0.68, 'rgba(255, 84, 120, 0.09)');
  glow.addColorStop(1, 'rgba(255, 77, 136, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, layout.width, layout.bandTop);

  const sprite = getSunSprite(radius);
  ctx.drawImage(sprite, cx - radius, cy - radius, radius * 2, radius * 2);
}

function paintSea(ctx, layout) {
  const sea = ctx.createLinearGradient(0, layout.horizon, 0, layout.bandTop);
  sea.addColorStop(0, '#30102e');
  sea.addColorStop(0.12, '#14122d');
  sea.addColorStop(0.62, '#081a30');
  sea.addColorStop(1, '#04101f');
  ctx.fillStyle = sea;
  ctx.fillRect(0, layout.horizon + 5, layout.width, layout.bandTop - layout.horizon);

  const random = mulberry32(layout.width + 83);
  const cx = layout.width * (layout.key === 'landscape' ? 0.535 : 0.56);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 20; i += 1) {
    const p = i / 20;
    const y = layout.horizon + 10 + p * (layout.bandTop - layout.horizon - 30);
    const width = layout.width * (0.015 + random() * 0.07) * (0.55 + p);
    const height = Math.max(1.5, layout.height * (0.0015 + random() * 0.003));
    ctx.fillStyle = `rgba(255, ${116 + Math.floor(random() * 75)}, ${55 + Math.floor(random() * 60)}, ${0.12 + (1 - p) * 0.25})`;
    ctx.fillRect(cx - width / 2 + (random() - 0.5) * layout.width * 0.1, y, width, height);
  }
  ctx.restore();
}

function paintSkyline(ctx, layout) {
  const baseY = layout.horizon + 9;
  const random = mulberry32(layout.width * 7 + 41);
  let x = -10;
  let index = 0;
  while (x < layout.width + 20) {
    const w = layout.width * (0.018 + random() * 0.042);
    const maxHeight = layout.height * (layout.key === 'landscape' ? 0.108 : 0.078);
    const h = maxHeight * (0.28 + random() * 0.72);
    const gradient = ctx.createLinearGradient(0, baseY - h, 0, baseY);
    gradient.addColorStop(0, index % 3 === 0 ? '#241936' : '#1a132d');
    gradient.addColorStop(1, '#080c1b');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, baseY - h, w, h);

    if (random() > 0.6) {
      const towerWidth = w * (0.25 + random() * 0.2);
      const towerHeight = h * (0.16 + random() * 0.25);
      ctx.fillRect(x + w * 0.38, baseY - h - towerHeight, towerWidth, towerHeight);
    }
    if (random() > 0.72) {
      ctx.fillRect(x + w * 0.5 - 1, baseY - h - h * 0.22, 2, h * 0.22);
    }

    const cols = Math.max(1, Math.floor(w / 12));
    const rows = Math.max(2, Math.floor(h / 22));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (random() > 0.73) {
          ctx.fillStyle = random() > 0.55 ? 'rgba(255, 189, 97, 0.58)' : 'rgba(255, 104, 138, 0.38)';
          ctx.fillRect(x + 5 + col * 12, baseY - h + 8 + row * 20, 4, 6);
        }
      }
    }

    ctx.fillStyle = '#070b19';
    ctx.fillRect(x, baseY - 3, w, 3);
    x += w + layout.width * (0.002 + random() * 0.009);
    index += 1;
  }

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const horizonLight = ctx.createLinearGradient(0, 0, layout.width, 0);
  horizonLight.addColorStop(0, 'rgba(255, 92, 172, 0)');
  horizonLight.addColorStop(0.5, 'rgba(255, 178, 103, 0.36)');
  horizonLight.addColorStop(1, 'rgba(255, 92, 172, 0)');
  ctx.fillStyle = horizonLight;
  ctx.fillRect(0, baseY - 1, layout.width, 2);
  ctx.restore();
}

function palmFrond(ctx, x, y, angle, length, width, droop) {
  const tipX = x + Math.cos(angle) * length;
  const tipY = y + Math.sin(angle) * length + droop;
  const sideX = Math.cos(angle + Math.PI / 2) * width;
  const sideY = Math.sin(angle + Math.PI / 2) * width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(
    x + Math.cos(angle) * length * 0.52 + sideX,
    y + Math.sin(angle) * length * 0.52 + sideY + droop * 0.45,
    tipX,
    tipY,
  );
  ctx.quadraticCurveTo(
    x + Math.cos(angle) * length * 0.48 - sideX,
    y + Math.sin(angle) * length * 0.48 - sideY + droop * 0.3,
    x,
    y,
  );
  ctx.fill();
}

function paintPalm(ctx, layout, side) {
  const scale = layout.height / 1080;
  const baseX = side < 0 ? layout.width * 0.033 : layout.width * 0.967;
  const baseY = layout.bandTop + 12;
  const topY = layout.height * 0.115;
  const lean = layout.width * (side < 0 ? 0.026 : -0.021);
  const topX = baseX + lean;
  const trunkWidth = Math.max(7, 18 * scale);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#061125';
  ctx.lineWidth = trunkWidth;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.bezierCurveTo(baseX + lean * 0.15, baseY * 0.68, topX - lean * 0.35, topY + 110 * scale, topX, topY);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(238, 164, 88, 0.23)';
  ctx.lineWidth = Math.max(1, 1.6 * scale);
  ctx.beginPath();
  ctx.moveTo(baseX - trunkWidth * 0.25, baseY);
  ctx.bezierCurveTo(baseX + lean * 0.12 - trunkWidth * 0.25, baseY * 0.68, topX - lean * 0.35 - trunkWidth * 0.18, topY + 110 * scale, topX - trunkWidth * 0.18, topY);
  ctx.stroke();

  ctx.strokeStyle = '#061125';
  ctx.lineWidth = Math.max(1.5, 3 * scale);
  const random = mulberry32(side < 0 ? 51 : 78);
  for (let i = 1; i < 11; i += 1) {
    const t = i / 11;
    const px = baseX + (topX - baseX) * Math.pow(t, 0.8) + Math.sin(t * Math.PI * 2) * trunkWidth * 0.7;
    const py = baseY - (baseY - topY) * t;
    ctx.beginPath();
    ctx.moveTo(px - trunkWidth * 0.8, py);
    ctx.lineTo(px + trunkWidth * 0.8, py + trunkWidth * 0.25);
    ctx.stroke();
  }

  const crownX = topX;
  const crownY = topY;
  ctx.fillStyle = '#061125';
  const baseAngle = side < 0 ? -0.15 : Math.PI + 0.15;
  for (let i = 0; i < 10; i += 1) {
    const spread = (i / 9 - 0.5) * Math.PI * 1.18;
    const angle = baseAngle + spread;
    const length = layout.width * (0.052 + random() * 0.055);
    const droop = layout.height * (0.018 + random() * 0.04);
    palmFrond(ctx, crownX, crownY, angle, length, Math.max(7, 20 * scale), droop);
  }

  for (let i = 0; i < 10; i += 1) {
    const spread = (i / 9 - 0.5) * Math.PI * 1.18;
    const angle = baseAngle + spread;
    const length = layout.width * (0.035 + random() * 0.035);
    ctx.save();
    ctx.globalAlpha = 0.45;
    palmFrond(ctx, crownX, crownY, angle, length, Math.max(4, 11 * scale), layout.height * 0.008);
    ctx.restore();
  }

  ctx.fillStyle = '#071327';
  for (let i = 0; i < 4; i += 1) {
    const angle = baseAngle + (i - 1.5) * 0.35;
    ctx.beginPath();
    ctx.arc(crownX + Math.cos(angle) * 18 * scale, crownY + Math.sin(angle) * 12 * scale, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function paintPhoto(ctx, rect, frameState) {
  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 2);
  ctx.clip();
  ctx.fillStyle = '#071225';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const photo = frameState.photo;
  const metrics = cropMetrics(rect, frameState, photo?.image);
  if (photo && metrics) {
    ctx.drawImage(photo.image, metrics.x, metrics.y, metrics.drawW, metrics.drawH);
    const grade = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grade.addColorStop(0, 'rgba(255, 31, 135, 0.2)');
    grade.addColorStop(0.4, 'rgba(255, 75, 103, 0.08)');
    grade.addColorStop(0.78, 'rgba(255, 147, 67, 0.11)');
    grade.addColorStop(1, 'rgba(44, 13, 63, 0.25)');
    ctx.fillStyle = grade;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    const glow = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    glow.addColorStop(0, 'rgba(255, 172, 96, 0.08)');
    glow.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
    glow.addColorStop(1, 'rgba(40, 8, 57, 0.2)');
    ctx.fillStyle = glow;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    const vignette = ctx.createRadialGradient(
      rect.x + rect.w * 0.48,
      rect.y + rect.h * 0.42,
      Math.min(rect.w, rect.h) * 0.2,
      rect.x + rect.w * 0.5,
      rect.y + rect.h * 0.5,
      Math.max(rect.w, rect.h) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(5, 9, 22, 0)');
    vignette.addColorStop(0.72, 'rgba(5, 9, 22, 0.06)');
    vignette.addColorStop(1, 'rgba(3, 7, 17, 0.48)');
    ctx.fillStyle = vignette;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else {
    const empty = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    empty.addColorStop(0, '#10213a');
    empty.addColorStop(0.5, '#0a152a');
    empty.addColorStop(1, '#1b1233');
    ctx.fillStyle = empty;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = 'rgba(232, 180, 91, 0.18)';
    ctx.lineWidth = 1;
    for (let x = rect.x - rect.h; x < rect.x + rect.w; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, rect.y + rect.h);
      ctx.lineTo(x + rect.h, rect.y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(232, 180, 91, 0.72)';
    ctx.font = `${Math.max(13, Math.min(rect.w, rect.h) * 0.095)}px Anton, Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD A SHOT', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  const sheen = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0.025)');
  ctx.fillStyle = sheen;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function paintFrames(ctx, layout, state, editing) {
  layout.frames.forEach((rect, index) => {
    const frameState = state.frames[index] ?? { mode: 'fill', zoom: 1, panX: 0, panY: 0, photo: null };
    ctx.save();
    ctx.shadowColor = 'rgba(1, 4, 11, 0.72)';
    ctx.shadowBlur = layout.width * 0.012;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = layout.width * 0.006;
    ctx.fillStyle = NAVY;
    ctx.fillRect(rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8);
    ctx.restore();

    paintPhoto(ctx, rect, frameState);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 237, 194, 0.32)';
    ctx.lineWidth = Math.max(1, layout.width * 0.0008);
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(2, layout.width * 0.0021);
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
    ctx.strokeStyle = 'rgba(91, 45, 18, 0.75)';
    ctx.lineWidth = Math.max(1, layout.width * 0.001);
    ctx.strokeRect(rect.x - 2.5, rect.y - 2.5, rect.w + 5, rect.h + 5);
    ctx.restore();

    if (editing && state.selected === index) {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 198, 103, 0.7)';
      ctx.shadowBlur = 22;
      ctx.strokeStyle = '#ffd27c';
      ctx.lineWidth = Math.max(3, layout.width * 0.0028);
      ctx.strokeRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8);
      ctx.restore();

      const length = Math.min(rect.w, rect.h) * 0.08;
      ctx.save();
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = Math.max(2, layout.width * 0.0018);
      ctx.beginPath();
      ctx.moveTo(rect.x + 13, rect.y + 13 + length);
      ctx.lineTo(rect.x + 13, rect.y + 13);
      ctx.lineTo(rect.x + 13 + length, rect.y + 13);
      ctx.stroke();
      ctx.restore();
    }
  });
}

function paintBand(ctx, layout, state) {
  const top = layout.bandTop;
  ctx.save();
  const band = ctx.createLinearGradient(0, top, 0, layout.height);
  band.addColorStop(0, '#081a32');
  band.addColorStop(0.55, '#061426');
  band.addColorStop(1, '#030b18');
  ctx.fillStyle = band;
  ctx.fillRect(0, top, layout.width, layout.height - top);

  const warm = ctx.createLinearGradient(0, top, 0, layout.height);
  warm.addColorStop(0, 'rgba(211, 45, 131, 0.08)');
  warm.addColorStop(0.6, 'rgba(5, 14, 30, 0)');
  warm.addColorStop(1, 'rgba(2, 8, 17, 0.35)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, top, layout.width, layout.height - top);

  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#a9c2d8';
  ctx.lineWidth = 1;
  for (let y = top + 6; y < layout.height; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(layout.width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const rule = ctx.createLinearGradient(0, 0, layout.width, 0);
  rule.addColorStop(0, 'rgba(232, 180, 91, 0.15)');
  rule.addColorStop(0.08, GOLD);
  rule.addColorStop(0.5, '#f4cf83');
  rule.addColorStop(0.92, GOLD);
  rule.addColorStop(1, 'rgba(232, 180, 91, 0.15)');
  ctx.fillStyle = rule;
  ctx.fillRect(layout.width * 0.035, top - 2, layout.width * 0.93, Math.max(2, layout.width * 0.0017));
  ctx.fillStyle = 'rgba(255, 231, 174, 0.6)';
  ctx.fillRect(layout.width * 0.035, top + 3, layout.width * 0.93, 1);

  const caption = (state.caption || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim().toUpperCase();
  const margin = layout.width * (layout.key === 'landscape' ? 0.04 : 0.055);
  const maxWidth = layout.width - margin * 2;

  if (caption) {
    const maxSize = layout.bandHeight * 0.62;
    const minSize = Math.max(24, layout.bandHeight * 0.16);
    let size = maxSize;
    ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
    while (ctx.measureText(caption).width > maxWidth && size > minSize) {
      size -= 2;
      ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
    }
    const baseline = top + layout.bandHeight * 0.54;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(1, 4, 12, 0.78)';
    ctx.fillText(caption, margin + Math.max(2, size * 0.025), baseline + Math.max(3, size * 0.04));
    ctx.fillStyle = 'rgba(255, 42, 131, 0.42)';
    ctx.fillText(caption, margin + Math.max(1, size * 0.01), baseline + Math.max(1, size * 0.012));
    ctx.fillStyle = '#ffffff';
    ctx.fillText(caption, margin, baseline);
  }

  if (subtitle) {
    const maxSubSize = Math.max(14, layout.bandHeight * 0.12);
    let size = maxSubSize;
    let tracking = Math.max(2, layout.bandHeight * 0.018);
    ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
    const measureTracked = () => {
      let width = 0;
      const chars = [...subtitle];
      chars.forEach((char, index) => {
        width += ctx.measureText(char).width;
        if (index < chars.length - 1) width += tracking;
      });
      return width;
    };
    while (measureTracked() > maxWidth && size > 12) {
      size -= 1;
      tracking = Math.max(1, tracking * 0.97);
      ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
    }
    const baseline = top + layout.bandHeight * 0.85;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 228, 169, 0.9)';
    ctx.fillRect(margin, baseline - size * 0.56, size * 0.92, Math.max(1, size * 0.055));
    let x = margin + size * 1.35;
    ctx.fillStyle = 'rgba(225, 237, 246, 0.86)';
    for (const char of subtitle) {
      ctx.fillText(char, x, baseline);
      x += ctx.measureText(char).width + tracking;
    }
  }

  const markX = layout.width - margin;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${Math.max(11, layout.bandHeight * 0.055)}px Anton, Impact, sans-serif`;
  ctx.fillStyle = 'rgba(232, 180, 91, 0.66)';
  ctx.fillText('PALM COAST / FL  ·  ORIGINAL POSTER', markX, layout.height - layout.bandHeight * 0.055);
  ctx.restore();
}

function paintTags(ctx, layout) {
  const margin = layout.width * 0.035;
  const tagW = layout.width * 0.205;
  const tagH = Math.max(48, layout.height * 0.06);
  const tagY = layout.height * 0.035;
  ctx.save();
  ctx.fillStyle = 'rgba(3, 10, 23, 0.82)';
  ctx.fillRect(margin, tagY, tagW, tagH);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1, layout.width * 0.0012);
  ctx.strokeRect(margin + 0.5, tagY + 0.5, tagW - 1, tagH - 1);
  ctx.fillStyle = GOLD;
  ctx.fillRect(margin + 8, tagY + 8, 3, tagH - 16);

  const crestR = tagH * 0.2;
  ctx.strokeStyle = '#f7cf84';
  ctx.lineWidth = Math.max(1, tagH * 0.018);
  ctx.beginPath();
  ctx.arc(margin + tagH * 0.36, tagY + tagH * 0.47, crestR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(margin + tagH * 0.36 - crestR * 0.7, tagY + tagH * 0.55);
  ctx.lineTo(margin + tagH * 0.36, tagY + tagH * 0.47);
  ctx.lineTo(margin + tagH * 0.36 + crestR * 0.7, tagY + tagH * 0.55);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = CREAM;
  ctx.font = `400 ${tagH * 0.34}px Anton, Impact, sans-serif`;
  ctx.fillText('PALM COAST', margin + tagH * 0.68, tagY + tagH * 0.4);
  ctx.fillStyle = 'rgba(232, 180, 91, 0.82)';
  ctx.font = `400 ${tagH * 0.175}px Anton, Impact, sans-serif`;
  let x = margin + tagH * 0.68;
  for (const char of 'PICTURES') {
    ctx.fillText(char, x, tagY + tagH * 0.69);
    x += ctx.measureText(char).width + tagH * 0.045;
  }

  const ratingW = layout.width * 0.055;
  const ratingH = ratingW * 1.12;
  const ratingX = layout.width - margin - ratingW;
  ctx.fillStyle = 'rgba(3, 10, 23, 0.86)';
  ctx.fillRect(ratingX, tagY, ratingW, ratingH);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1, layout.width * 0.0012);
  ctx.strokeRect(ratingX + 0.5, tagY + 0.5, ratingW - 1, ratingH - 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = CREAM;
  ctx.font = `400 ${ratingH * 0.54}px Anton, Impact, sans-serif`;
  ctx.fillText('M', ratingX + ratingW / 2, tagY + ratingH * 0.48);
  ctx.fillStyle = GOLD;
  ctx.font = `400 ${ratingH * 0.12}px Anton, Impact, sans-serif`;
  ctx.fillText('MATURE 17+', ratingX + ratingW / 2, tagY + ratingH * 0.82);
  ctx.restore();
}

function paintFinish(ctx, layout) {
  const vignette = ctx.createRadialGradient(
    layout.width / 2,
    layout.height * 0.43,
    Math.min(layout.width, layout.height) * 0.25,
    layout.width / 2,
    layout.height * 0.5,
    Math.max(layout.width, layout.height) * 0.78,
  );
  vignette.addColorStop(0, 'rgba(2, 5, 14, 0)');
  vignette.addColorStop(0.72, 'rgba(2, 5, 14, 0.04)');
  vignette.addColorStop(1, 'rgba(1, 3, 10, 0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const pattern = getGrainPattern(ctx);
  if (pattern) {
    ctx.save();
    ctx.globalAlpha = 0.065;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(232, 180, 91, 0.76)';
  ctx.lineWidth = Math.max(1, layout.width * 0.0011);
  ctx.strokeRect(layout.width * 0.012, layout.height * 0.012, layout.width * 0.976, layout.height * 0.976);
  ctx.strokeStyle = 'rgba(2, 7, 16, 0.8)';
  ctx.lineWidth = Math.max(2, layout.width * 0.002);
  ctx.strokeRect(layout.width * 0.008, layout.height * 0.008, layout.width * 0.984, layout.height * 0.984);
  ctx.restore();
}

export function drawPoster(canvas, state, options = {}) {
  const layout = getLayout(state.format);
  if (canvas.width !== layout.width || canvas.height !== layout.height) {
    canvas.width = layout.width;
    canvas.height = layout.height;
  }
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  paintSky(ctx, layout);
  paintSun(ctx, layout);
  paintSea(ctx, layout);
  paintSkyline(ctx, layout);
  paintPalm(ctx, layout, -1);
  paintPalm(ctx, layout, 1);
  paintFrames(ctx, layout, state, Boolean(options.editing));
  paintTags(ctx, layout);
  paintBand(ctx, layout, state);
  paintFinish(ctx, layout);
  ctx.restore();
  return layout;
}
