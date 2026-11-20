import {
  FORMATS,
  FRAME_ROLES,
  cropMetrics,
  drawPoster,
  frameAtPoint,
  getLayout,
} from './poster.js';
import {
  CAPTION_PRESETS,
  DEFAULT_CAPTION,
  DEFAULT_SUBTITLE,
} from './presets.js';

const poster = document.getElementById('poster');
const frameSlots = document.getElementById('frameSlots');
const library = document.getElementById('library');
const photoCount = document.getElementById('photoCount');
const fileInput = document.getElementById('fileInput');
const clearFrame = document.getElementById('clearFrame');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const presetRow = document.getElementById('presetRow');
const formatTabs = document.getElementById('formatTabs');
const formatRatio = document.getElementById('formatRatio');
const selectionChip = document.getElementById('selectionChip');
const canvasDims = document.getElementById('canvasDims');
const frameTag = document.getElementById('frameTag');
const selectedImage = document.getElementById('selectedImage');
const selectedTitle = document.getElementById('selectedTitle');
const selectedPhoto = document.getElementById('selectedPhoto');
const modeTabs = document.getElementById('modeTabs');
const zoomSlider = document.getElementById('zoom');
const zoomValue = document.getElementById('zoomValue');
const borrowSelect = document.getElementById('borrowSelect');
const resetCrop = document.getElementById('resetCrop');
const removePhoto = document.getElementById('removePhoto');
const sizeSelect = document.getElementById('sizeSelect');
const outputDims = document.getElementById('outputDims');
const exportBtn = document.getElementById('exportBtn');
const status = document.getElementById('status');
const dropOverlay = document.getElementById('dropOverlay');

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const shotMode = ['landscape', 'square', 'portrait', 'editor'].includes(shot) ? shot : null;
const posterOnly = Boolean(shotMode && shotMode !== 'editor');

const state = {
  format: 'square',
  caption: DEFAULT_CAPTION,
  subtitle: DEFAULT_SUBTITLE,
  selected: 0,
  photos: [],
  frames: Array.from({ length: 4 }, () => ({
    photo: null,
    mode: 'fill',
    zoom: 1,
    panX: 0,
    panY: 0,
  })),
};

let drag = null;
let dragDepth = 0;
let pendingFrame = 0;
let photoSeed = 0;
let statusTimer = 0;

if (shotMode) {
  document.body.classList.add(shotMode === 'editor' ? 'shot-editor' : 'shot');
}

function setStatus(message, tone = '') {
  status.textContent = message;
  status.classList.remove('good', 'bad');
  if (tone) status.classList.add(tone);
  if (statusTimer) clearTimeout(statusTimer);
  if (tone) {
    statusTimer = setTimeout(() => {
      status.textContent = 'Ready · no network needed';
      status.classList.remove('good', 'bad');
    }, 5200);
  }
}

function requestDraw() {
  if (pendingFrame) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0;
    drawPoster(poster, state, {
      editing: !posterOnly,
      selected: state.selected,
    });
  });
}

function paintNow() {
  drawPoster(poster, state, {
    editing: !posterOnly,
    selected: state.selected,
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be read.'));
    image.src = src;
  });
}

function photoName(fileName) {
  return fileName.replace(/\.[^.]+$/, '').slice(0, 36) || 'Untitled shot';
}

function resetFrame(frame) {
  frame.zoom = 1;
  frame.panX = 0;
  frame.panY = 0;
}

function assignPhoto(index, photo, { reset = true } = {}) {
  const frame = state.frames[index];
  if (!frame || !photo) return;
  if (frame.photo !== photo) {
    frame.photo = photo;
    if (reset) resetFrame(frame);
  }
  state.selected = index;
  syncAll();
  requestDraw();
}

function useFramePhoto(sourceIndex) {
  const source = state.frames[sourceIndex];
  const target = state.frames[state.selected];
  if (!source || !target || !source.photo) return;
  target.photo = source.photo;
  target.mode = source.mode;
  target.zoom = source.zoom;
  target.panX = source.panX;
  target.panY = source.panY;
  syncAll();
  requestDraw();
  setStatus(`Reused ${source.photo.name} from ${FRAME_ROLES[sourceIndex]}.`, 'good');
}

function selectFrame(index) {
  state.selected = Math.max(0, Math.min(3, index));
  syncInspector();
  renderSlots();
  requestDraw();
}

function setFormat(format) {
  if (!FORMATS[format]) return;
  state.format = format;
  syncFormat();
  requestDraw();
}

function syncFormat() {
  const format = FORMATS[state.format];
  formatTabs.querySelectorAll('button').forEach((button) => {
    const active = button.dataset.format === state.format;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  sizeSelect.value = state.format;
  formatRatio.textContent = format.ratio;
  canvasDims.textContent = `${format.width} × ${format.height}`;
  outputDims.textContent = `${format.width} × ${format.height}`;
  const role = FRAME_ROLES[state.selected].toUpperCase();
  selectionChip.textContent = `${role} SELECTED`;
}

function syncPresetState() {
  presetRow.querySelectorAll('button').forEach((button) => {
    const preset = CAPTION_PRESETS[Number(button.dataset.preset)];
    button.classList.toggle(
      'active',
      preset.caption === state.caption && preset.subtitle === state.subtitle,
    );
  });
}

function renderSlots() {
  const nodes = [];
  state.frames.forEach((frame, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `frame-slot${state.selected === index ? ' selected' : ''}${frame.photo ? '' : ' empty'}`;
    button.dataset.frame = String(index);
    button.setAttribute('aria-label', `${FRAME_ROLES[index]} frame${frame.photo ? `, ${frame.photo.name}` : ', empty'}`);

    if (frame.photo) {
      const image = document.createElement('img');
      image.src = frame.photo.src;
      image.alt = '';
      image.draggable = false;
      const shade = document.createElement('span');
      shade.className = 'slot-shade';
      button.append(image, shade);
    } else {
      const empty = document.createElement('span');
      empty.className = 'slot-empty-label';
      const plus = document.createElement('b');
      plus.textContent = '+';
      const label = document.createElement('span');
      label.textContent = 'ADD PHOTO';
      empty.append(plus, label);
      button.append(empty);
    }

    const number = document.createElement('span');
    number.className = 'slot-index';
    number.textContent = String(index + 1).padStart(2, '0');
    const role = document.createElement('span');
    role.className = 'slot-role';
    role.textContent = FRAME_ROLES[index].toUpperCase();
    button.append(number, role);
    button.addEventListener('click', () => selectFrame(index));
    nodes.push(button);
  });
  frameSlots.replaceChildren(...nodes);
  photoCount.textContent = state.photos.length === 1 ? '1 SHOT' : `${state.photos.length} SHOTS`;
}

function renderLibrary() {
  if (!state.photos.length) {
    const empty = document.createElement('div');
    empty.className = 'library-empty';
    empty.textContent = 'Your downloaded photos live here.';
    library.replaceChildren(empty);
    return;
  }
  const nodes = state.photos.map((photo) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'library-item';
    button.title = `Use ${photo.name} in ${FRAME_ROLES[state.selected]}`;
    const image = document.createElement('img');
    image.src = photo.src;
    image.alt = '';
    image.draggable = false;
    const label = document.createElement('span');
    label.textContent = photo.name;
    button.append(image, label);
    button.addEventListener('click', () => {
      assignPhoto(state.selected, photo);
      setStatus(`${photo.name} placed in ${FRAME_ROLES[state.selected]}.`, 'good');
    });
    return button;
  });
  library.replaceChildren(...nodes);
}

function renderPresets() {
  presetRow.replaceChildren(
    ...CAPTION_PRESETS.map((preset, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preset-chip';
      button.dataset.preset = String(index);
      button.textContent = preset.caption;
      button.title = preset.subtitle;
      button.addEventListener('click', () => {
        state.caption = preset.caption;
        state.subtitle = preset.subtitle;
        captionInput.value = preset.caption;
        subtitleInput.value = preset.subtitle;
        syncPresetState();
        requestDraw();
      });
      return button;
    }),
  );
  syncPresetState();
}

function syncInspector() {
  const frame = state.frames[state.selected];
  const role = FRAME_ROLES[state.selected];
  const shortRole = state.selected === 0 ? 'HERO' : String(state.selected + 1).padStart(2, '0');
  frameTag.textContent = shortRole;
  selectedTitle.textContent = `${role.toUpperCase()} FRAME`;
  selectionChip.textContent = `${role.toUpperCase()} SELECTED`;

  selectedImage.replaceChildren();
  if (frame.photo) {
    const image = document.createElement('img');
    image.src = frame.photo.src;
    image.alt = '';
    selectedImage.append(image);
    selectedPhoto.textContent = frame.photo.name;
  } else {
    const number = document.createElement('span');
    number.textContent = shortRole;
    selectedImage.append(number);
    selectedPhoto.textContent = 'No photo yet';
  }

  modeTabs.querySelectorAll('button').forEach((button) => {
    const active = button.dataset.mode === frame.mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const zoomPercent = Math.round(frame.zoom * 100);
  zoomSlider.value = String(zoomPercent);
  zoomValue.textContent = `${zoomPercent}%`;
  zoomSlider.disabled = !frame.photo;
  resetCrop.disabled = !frame.photo;
  removePhoto.disabled = !frame.photo;
  borrowSelect.disabled = !state.frames.some((other, index) => index !== state.selected && other.photo);

  const options = [new Option('Choose a frame', '')];
  state.frames.forEach((other, index) => {
    if (index !== state.selected && other.photo) {
      options.push(new Option(`${FRAME_ROLES[index]} · ${other.photo.name}`, String(index)));
    }
  });
  borrowSelect.replaceChildren(...options);
  borrowSelect.value = '';
}

function syncAll() {
  syncPresetState();
  syncFormat();
  renderSlots();
  renderLibrary();
  syncInspector();
}

async function ingestFiles(fileList) {
  const files = Array.from(fileList).filter((file) => (
    file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name)
  ));
  if (!files.length) {
    setStatus('Those files were not recognised as images.', 'bad');
    return;
  }

  setStatus(`Reading ${files.length === 1 ? 'your photo' : `${files.length} photos`} locally…`);
  const loaded = [];
  for (const file of files) {
    const src = URL.createObjectURL(file);
    try {
      const image = await loadImage(src);
      loaded.push({
        id: `photo-${photoSeed += 1}`,
        name: photoName(file.name),
        image,
        src,
      });
    } catch {
      URL.revokeObjectURL(src);
    }
  }

  if (!loaded.length) {
    setStatus('No readable images were found in that drop.', 'bad');
    return;
  }

  state.photos.push(...loaded);
  const allEmpty = state.frames.every((frame) => !frame.photo);
  if (allEmpty) {
    state.frames.forEach((frame, index) => {
      frame.photo = loaded[index % loaded.length];
      resetFrame(frame);
    });
    state.selected = 0;
  } else {
    const empties = state.frames
      .map((frame, index) => (frame.photo ? -1 : index))
      .filter((index) => index >= 0);
    if (empties.length) {
      loaded.slice(0, empties.length).forEach((photo, index) => {
        const frame = state.frames[empties[index]];
        frame.photo = photo;
        resetFrame(frame);
      });
      state.selected = empties[0];
    } else if (loaded[0]) {
      assignPhoto(state.selected, loaded[0]);
    }
  }

  syncAll();
  requestDraw();
  setStatus(
    `${loaded.length === 1 ? 'One photo' : `${loaded.length} photos`} added · kept on this device.`,
    'good',
  );
}

function slugForFile() {
  return (state.caption || 'palm-coast-cover')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'palm-coast-cover';
}

async function exportPng() {
  const format = FORMATS[state.format];
  exportBtn.disabled = true;
  setStatus('Rendering your PNG…');
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = format.width;
    canvas.height = format.height;
    drawPoster(canvas, state, { editing: false, selected: state.selected });
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('The browser could not encode this PNG.'));
      }, 'image/png');
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${slugForFile()}-${format.width}x${format.height}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    setStatus(`Saved ${format.width} × ${format.height} PNG · stays on your machine.`, 'good');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'The PNG could not be made.', 'bad');
  } finally {
    exportBtn.disabled = false;
  }
}

function pointOnPoster(event) {
  const rect = poster.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * poster.width,
    y: ((event.clientY - rect.top) / rect.height) * poster.height,
    rect,
  };
}

function dragFrame(event, index) {
  const frame = state.frames[index];
  if (!frame?.photo) return;
  const point = pointOnPoster(event);
  const layout = getLayout(state.format);
  const metrics = cropMetrics(layout.frames[index], frame, frame.photo.image);
  if (!metrics) return;
  const dx = ((event.clientX - drag.lastX) / point.rect.width) * poster.width;
  const dy = ((event.clientY - drag.lastY) / point.rect.height) * poster.height;
  if (metrics.limitX > 0) {
    frame.panX = Math.max(-1, Math.min(1, frame.panX + dx / metrics.limitX));
  }
  if (metrics.limitY > 0) {
    frame.panY = Math.max(-1, Math.min(1, frame.panY + dy / metrics.limitY));
  }
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  requestDraw();
}

function bindEvents() {
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files ?? []);
    fileInput.value = '';
    if (files.length) await ingestFiles(files);
  });

  window.addEventListener('dragover', (event) => {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  });
  window.addEventListener('dragenter', (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    dragDepth += 1;
    dropOverlay.classList.add('show');
  });
  window.addEventListener('dragleave', (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropOverlay.classList.remove('show');
  });
  window.addEventListener('drop', async (event) => {
    event.preventDefault();
    dragDepth = 0;
    dropOverlay.classList.remove('show');
    if (event.dataTransfer?.files?.length) await ingestFiles(event.dataTransfer.files);
  });

  captionInput.addEventListener('input', () => {
    state.caption = captionInput.value;
    syncPresetState();
    requestDraw();
  });
  subtitleInput.addEventListener('input', () => {
    state.subtitle = subtitleInput.value;
    syncPresetState();
    requestDraw();
  });

  formatTabs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-format]');
    if (button) setFormat(button.dataset.format);
  });
  sizeSelect.addEventListener('change', () => setFormat(sizeSelect.value));

  modeTabs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-mode]');
    if (!button) return;
    const frame = state.frames[state.selected];
    frame.mode = button.dataset.mode;
    resetFrame(frame);
    syncAll();
    requestDraw();
  });

  zoomSlider.addEventListener('input', () => {
    const frame = state.frames[state.selected];
    if (!frame.photo) return;
    frame.zoom = Number(zoomSlider.value) / 100;
    zoomValue.textContent = `${zoomSlider.value}%`;
    requestDraw();
  });

  borrowSelect.addEventListener('change', () => {
    if (borrowSelect.value === '') return;
    useFramePhoto(Number(borrowSelect.value));
  });

  resetCrop.addEventListener('click', () => {
    const frame = state.frames[state.selected];
    if (!frame.photo) return;
    resetFrame(frame);
    syncInspector();
    requestDraw();
    setStatus('Crop reset to centre.', 'good');
  });

  removePhoto.addEventListener('click', () => {
    const frame = state.frames[state.selected];
    if (!frame.photo) return;
    frame.photo = null;
    resetFrame(frame);
    syncAll();
    requestDraw();
    setStatus(`${FRAME_ROLES[state.selected]} cleared.`, 'good');
  });

  clearFrame.addEventListener('click', () => {
    const frame = state.frames[state.selected];
    if (!frame.photo) {
      setStatus('That frame is already empty.');
      return;
    }
    frame.photo = null;
    resetFrame(frame);
    syncAll();
    requestDraw();
    setStatus(`${FRAME_ROLES[state.selected]} cleared.`, 'good');
  });

  exportBtn.addEventListener('click', exportPng);

  poster.addEventListener('pointerdown', (event) => {
    const point = pointOnPoster(event);
    const layout = getLayout(state.format);
    const index = frameAtPoint(layout, point.x, point.y);
    if (index < 0) return;
    selectFrame(index);
    const frame = state.frames[index];
    if (!frame.photo) return;
    event.preventDefault();
    poster.setPointerCapture(event.pointerId);
    drag = { index, lastX: event.clientX, lastY: event.clientY };
  });

  poster.addEventListener('pointermove', (event) => {
    if (!drag) return;
    dragFrame(event, drag.index);
  });

  const endDrag = (event) => {
    if (!drag) return;
    if (poster.hasPointerCapture(event.pointerId)) poster.releasePointerCapture(event.pointerId);
    drag = null;
  };
  poster.addEventListener('pointerup', endDrag);
  poster.addEventListener('pointercancel', endDrag);
  poster.addEventListener('lostpointercapture', () => {
    drag = null;
  });

  poster.addEventListener('wheel', (event) => {
    const point = pointOnPoster(event);
    const layout = getLayout(state.format);
    const index = frameAtPoint(layout, point.x, point.y);
    if (index < 0) return;
    const frame = state.frames[index];
    if (!frame.photo) return;
    event.preventDefault();
    if (state.selected !== index) selectFrame(index);
    frame.zoom = Math.max(1, Math.min(4, frame.zoom * Math.exp(-event.deltaY * 0.0014)));
    const percent = Math.round(frame.zoom * 100);
    zoomSlider.value = String(percent);
    zoomValue.textContent = `${percent}%`;
    requestDraw();
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      selectFrame((state.selected + direction + 4) % 4);
    }
  });

  window.addEventListener('beforeunload', () => {
    for (const photo of state.photos) {
      if (photo.src.startsWith('blob:')) URL.revokeObjectURL(photo.src);
    }
  });
}

function loadSamplePhoto(slug) {
  const src = `./samples/${slug}.jpg`;
  return loadImage(src).then((image) => ({
    id: `sample-${slug}`,
    name: `${slug}.jpg`,
    image,
    src,
  }));
}

async function setUpShot(mode) {
  state.format = mode === 'editor' ? 'square' : mode;
  state.caption = DEFAULT_CAPTION;
  state.subtitle = DEFAULT_SUBTITLE;
  captionInput.value = DEFAULT_CAPTION;
  subtitleInput.value = DEFAULT_SUBTITLE;

  try {
    await document.fonts.load('64px Anton', 'COASTLINE HEAT');
  } catch {
    setStatus('Using a system display face.', 'bad');
  }

  const [boulevard, pier] = await Promise.all([
    loadSamplePhoto('boulevard'),
    loadSamplePhoto('pier'),
  ]);

  state.photos = [boulevard, pier];
  const samples = {
    landscape: [boulevard, pier, boulevard, pier],
    square: [boulevard, pier, boulevard, pier],
    portrait: [boulevard, pier, boulevard, pier],
  };
  const crops = {
    landscape: [
      { zoom: 1.08, panX: 0, panY: 0.86 },
      { zoom: 1.04, panX: 0, panY: 0.1 },
      { zoom: 1.12, panX: -0.15, panY: 0.3 },
      { zoom: 1.05, panX: 0, panY: 0.92 },
    ],
    square: [
      { zoom: 1.04, panX: 0, panY: 0.72 },
      { zoom: 1.03, panX: 0, panY: 0.2 },
      { zoom: 1.05, panX: -0.05, panY: 0.65 },
      { zoom: 1.05, panX: 0, panY: 0.85 },
    ],
    portrait: [
      { zoom: 1.03, panX: 0, panY: 0.88 },
      { zoom: 1.05, panX: 0, panY: 0.55 },
      { zoom: 1.1, panX: -0.12, panY: 0.78 },
      { zoom: 1.02, panX: 0, panY: 0.45 },
    ],
  };

  state.frames.forEach((frame, index) => {
    frame.photo = samples[state.format][index];
    frame.mode = 'fill';
    resetFrame(frame);
    const crop = crops[state.format][index];
    frame.zoom = crop.zoom;
    frame.panX = crop.panX;
    frame.panY = crop.panY;
  });
  state.selected = 0;
  syncAll();
  paintNow();
  await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}

async function boot() {
  bindEvents();
  renderPresets();

  if (shotMode) {
    try {
      await setUpShot(shotMode);
    } catch {
      setStatus('The built-in sample photos could not be loaded.', 'bad');
    }
    return;
  }

  syncAll();
  try {
    await document.fonts.ready;
  } catch {
    setStatus('Using a system display face.', 'bad');
  }
  paintNow();
}

boot();
