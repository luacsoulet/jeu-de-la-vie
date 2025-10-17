document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // 🎮 Elements
  const cellSize = 10;
  const heightInput = document.getElementById("height");
  const widthInput = document.getElementById("width");
  const speedInput = document.getElementById("speed");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const drawBtn = document.getElementById("drawModeBtn");
  const eraseBtn = document.getElementById("eraseBtn");
  const randomBtn = document.getElementById("randomBtn");
  const resetBtn = document.getElementById("resetBtn");
  const colordead = document.getElementById("colorPickerdead");
  const coloralive = document.getElementById("colorPickeralive");
  const gridColorPicker = document.getElementById("gridColorPicker");

  // 🧠 Variables principales
  let rows = 0;
  let cols = 0;
  // Grilles plates (TypedArrays) pour des accès rapides
  let grid = new Uint8Array(0);
  let nextGrid = new Uint8Array(0);
  // Indices voisins pré-calculés: neighborsIdx[i*8 + k] => index du k-ième voisin de i
  let neighborsIdx = new Uint32Array(0);
  let running = false, drawingMode = false;
  let cyclesPerSec = +speedInput.value || 60;
  let lastFrameTime = 0, generation = 0;
  let animationFrameId = null;
  const wrapEdges = true;
  let cachedDead = colordead.value, cachedAlive = coloralive.value;
  let isMouseDown = false; // état pour dessiner en maintenant le clic
  let lastPaintedKey = null; // évite de repeindre la même case à répétition pendant le glisser
  let gridColor = (gridColorPicker && gridColorPicker.value) || "#9ca3af";

  // ⚙️ Initialisation
  const resizeCanvas = () => {
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    // Désactiver le lissage pour un rendu net en pixel-art lorsqu'on upscale
    ctx.imageSmoothingEnabled = false;
  };

  // Offscreen canvas pour composer l'image à la résolution de la grille, puis upscaler
  let offscreen = document.createElement("canvas");
  let offctx = offscreen.getContext("2d", { willReadFrequently: false });
  let imageData = null; // ImageData pour la frame courante

  const indexOf = (r, c) => r * cols + c;

  const createGrid = (empty = true) => {
    const size = rows * cols;
    grid = new Uint8Array(size);
    nextGrid = new Uint8Array(size);
    if (!empty) {
      for (let i = 0; i < size; i++) grid[i] = Math.random() < 0.5 ? 1 : 0;
    }

    // Pré-calcule des voisins (wrapEdges true)
    neighborsIdx = new Uint32Array(size * 8);
    for (let r = 0; r < rows; r++) {
      const rUp = (r - 1 + rows) % rows;
      const rDn = (r + 1) % rows;
      for (let c = 0; c < cols; c++) {
        const cLf = (c - 1 + cols) % cols;
        const cRt = (c + 1) % cols;
        const i = indexOf(r, c);
        let k = i * 8;
        neighborsIdx[k++] = indexOf(rUp, cLf);
        neighborsIdx[k++] = indexOf(rUp, c);
        neighborsIdx[k++] = indexOf(rUp, cRt);
        neighborsIdx[k++] = indexOf(r, cLf);
        neighborsIdx[k++] = indexOf(r, cRt);
        neighborsIdx[k++] = indexOf(rDn, cLf);
        neighborsIdx[k++] = indexOf(rDn, c);
        neighborsIdx[k++] = indexOf(rDn, cRt);
      }
    }

    // Offscreen à la résolution de la grille
    offscreen.width = cols;
    offscreen.height = rows;
    imageData = offctx.createImageData(cols, rows);

    resizeCanvas();
  };

  // 🧩 Formes initiales
  const shapes = {
    glider: [[0,1],[1,2],[2,0],[2,1],[2,2]],
    exploder: [[0,0],[0,1],[0,2],[0,3],[0,4],[2,0],[2,4],[4,0],[4,1],[4,2],[4,3],[4,4]],
  };

  const drawShape = (name) => {
    const shape = shapes[name];
    if (!shape) return;
    const maxR = Math.max(...shape.map(([r]) => r));
    const maxC = Math.max(...shape.map(([_, c]) => c));
    const offR = Math.floor((rows - maxR) / 2);
    const offC = Math.floor((cols - maxC) / 2);
    for (const [r, c] of shape) {
      const rr = r + offR;
      const cc = c + offC;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
        const idx = rr * cols + cc;
        if (idx >= 0 && idx < grid.length) grid[idx] = 1;
      }
    }
  };

  // 🎨 Dessin
  // Conversion hex couleur -> RGB
  const hexToRgb = (hex) => {
    const v = hex.startsWith('#') ? hex.slice(1) : hex;
    const n = parseInt(v.length === 3 ? v.split('').map(ch => ch + ch).join('') : v, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  let rgbDead = hexToRgb(cachedDead);
  let rgbAlive = hexToRgb(cachedAlive);

  const drawCell = (r, c, state) => {
    // Dessin direct pour feedback immédiat en mode dessin
    ctx.fillStyle = state ? cachedAlive : cachedDead;
    ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
  };

  const drawGrid = () => {
    if (!imageData) return;
    const data = imageData.data;
    const size = rows * cols;
    const [rd0, gd0, bd0] = rgbDead;
    const [ra0, ga0, ba0] = rgbAlive;
    for (let i = 0, p = 0; i < size; i++, p += 4) {
      const alive = grid[i];
      if (alive) {
        data[p] = ra0; data[p + 1] = ga0; data[p + 2] = ba0; data[p + 3] = 255;
      } else {
        data[p] = rd0; data[p + 1] = gd0; data[p + 2] = bd0; data[p + 3] = 255;
      }
    }
    offctx.putImageData(imageData, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0, offscreen.width, offscreen.height, 0, 0, canvas.width, canvas.height);
    // Overlay grille visuelle
    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) {
      const x = c * cellSize + 0.5; // alignement pixel
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rows * cellSize);
    }
    for (let r = 0; r <= rows; r++) {
      const y = r * cellSize + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(cols * cellSize, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  // 🧮 Logique du jeu
  const countNeighborsFlat = (i) => {
    const base = i * 8;
    return grid[neighborsIdx[base]] + grid[neighborsIdx[base + 1]] + grid[neighborsIdx[base + 2]] +
           grid[neighborsIdx[base + 3]] + grid[neighborsIdx[base + 4]] + grid[neighborsIdx[base + 5]] +
           grid[neighborsIdx[base + 6]] + grid[neighborsIdx[base + 7]];
  };

  const nextGeneration = () => {
    const size = rows * cols;
    for (let i = 0; i < size; i++) {
      const n = countNeighborsFlat(i);
      const alive = grid[i];
      const newState = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      nextGrid[i] = newState;
    }
    // swap buffers
    const tmp = grid; grid = nextGrid; nextGrid = tmp;
    generation++;
  };

  // 🌀 Boucle principale
  const renderLoop = (t) => {
    if (!running) return;
    if (!lastFrameTime) lastFrameTime = t;
    const elapsed = t - lastFrameTime, interval = 1000 / cyclesPerSec;
    if (elapsed >= interval) {
      lastFrameTime = t - (elapsed % interval);
      const iterations = Math.floor(elapsed / interval);
      for (let i = 0; i < iterations; i++) nextGeneration();
      // Rendu plein (plus rapide que gérer les diffs pour très hauts taux)
      drawGrid();
    }
    animationFrameId = requestAnimationFrame(renderLoop);
  };

  // ▶️ Simulation
  const startSimulation = () => {
    if (running) return;
    running = true;
    drawingMode = false; // le lancement de la simulation désactive le mode dessin
    updateUIState("start");
    lastFrameTime = 0;
    animationFrameId = requestAnimationFrame(renderLoop);
  };

  const pauseSimulation = () => {
    running = false;
    updateUIState("pause");
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  };

  const wipeGrid = () => { pauseSimulation(); createGrid(true); drawGrid(); generation = 0; };
  const randomFill = () => { pauseSimulation(); createGrid(false); drawGrid(); generation = 0; };

  // 🎛️ Gestion UI (états et couleurs)
  const allBtns = [startBtn, pauseBtn, drawBtn, eraseBtn, randomBtn, resetBtn];
  const updateUIState = (state) => {
    allBtns.forEach(b => b?.classList.remove("active"));
    switch (state) {
      case "start": startBtn.classList.add("active"); break;
      case "pause": pauseBtn.classList.add("active"); break;
      case "draw": drawBtn.classList.add("active"); break;
    }
    // Si le mode dessin est actif, on s'assure que le bouton reste visuellement actif
    if (drawingMode) drawBtn.classList.add("active");
  };

  // 🖱️ Événements
  startBtn.onclick = () => { startSimulation(); };
  pauseBtn.onclick = () => { pauseSimulation(); };
  drawBtn.onclick = () => {
    drawingMode = !drawingMode;
    if (drawingMode) {
      pauseSimulation();
      updateUIState("draw");
      console.log("✏️ Mode dessin activé.");
    } else {
      updateUIState(null);
      console.log("🧩 Mode dessin désactivé.");
    }
  };
  eraseBtn.onclick = () => { wipeGrid(); eraseBtn.classList.add("active"); setTimeout(() => eraseBtn.classList.remove("active"), 300); };
  randomBtn.onclick = () => { randomFill(); randomBtn.classList.add("active"); setTimeout(() => randomBtn.classList.remove("active"), 300); };
  resetBtn.onclick = () => { wipeGrid(); resetBtn.classList.add("active"); setTimeout(() => resetBtn.classList.remove("active"), 300); };

  // 🖋️ Mode dessin
  // Utilitaire pour récupérer la cellule visée par un événement souris
  const getCellFromEvent = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    return { x, y };
  };

  // Clic simple (toggle)
  canvas.addEventListener("click", (e) => {
    if (!drawingMode) return;
    const { x, y } = getCellFromEvent(e);
    const idx = y * cols + x;
    if (idx >= 0 && idx < grid.length) {
      grid[idx] = grid[idx] ? 0 : 1;
      drawCell(y, x, grid[idx]);
    }
  });

  // Maintien du clic + déplacement pour dessiner en continu (pose des cellules vivantes)
  canvas.addEventListener("mousedown", (e) => {
    if (!drawingMode) return;
    isMouseDown = true;
    lastPaintedKey = null;
    const { x, y } = getCellFromEvent(e);
    const idx = y * cols + x;
    if (idx >= 0 && idx < grid.length) {
      grid[idx] = 1;
      drawCell(y, x, 1);
      lastPaintedKey = `${x},${y}`;
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!drawingMode || !isMouseDown) return;
    const { x, y } = getCellFromEvent(e);
    const key = `${x},${y}`;
    if (key === lastPaintedKey) return;
    const idx = y * cols + x;
    if (idx >= 0 && idx < grid.length) {
      grid[idx] = 1;
      drawCell(y, x, 1);
      lastPaintedKey = key;
    }
  });

  canvas.addEventListener("mouseup", (e) => {
    if (drawingMode && isMouseDown) {
      const { x, y } = getCellFromEvent(e);
      const idx = y * cols + x;
      if (idx >= 0 && idx < grid.length) {
        grid[idx] = 1; // force la dernière cellule à être peinte
        drawCell(y, x, 1);
      }
    }
    isMouseDown = false; lastPaintedKey = null;
  });
  canvas.addEventListener("mouseleave", () => { isMouseDown = false; lastPaintedKey = null; });

  // 🎚️ Inputs
  speedInput.oninput = () => cyclesPerSec = +speedInput.value || 1;
  colordead.oninput = () => { cachedDead = colordead.value; rgbDead = hexToRgb(cachedDead); drawGrid(); };
  coloralive.oninput = () => { cachedAlive = coloralive.value; rgbAlive = hexToRgb(cachedAlive); drawGrid(); };
  if (gridColorPicker) gridColorPicker.oninput = () => { gridColor = gridColorPicker.value; drawGrid(); };

  heightInput.oninput = () => {
    const val = parseInt(heightInput.value);
    if (val > 0 && val !== rows) {
      rows = val;
      createGrid(true);
      drawGrid();
    }
  };

  widthInput.oninput = () => {
    const val = parseInt(widthInput.value);
    if (val > 0 && val !== cols) {
      cols = val;
      createGrid(true);
      drawGrid();
    }
  };

  // 🖥️ Ajustement de la grille selon la fenêtre et ratio 16:9
  const adjustGridToWindow = () => {
    cols = Math.floor(window.innerWidth / cellSize * 0.8);
    rows = Math.floor(cols * 9 / 16);
    widthInput.value = cols;
    heightInput.value = rows;
    createGrid(true);
    drawGrid();
  };

  window.addEventListener("resize", adjustGridToWindow);

  // 🧩 Lancement
  adjustGridToWindow();
  drawShape("glider");
  drawGrid();
  updateUIState("start");
  startSimulation();

  console.log("🚀 Jeu de la Vie initialisé avec gestion complète des états visuels.");
});