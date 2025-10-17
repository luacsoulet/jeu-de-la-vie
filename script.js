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

  // 🧠 Variables principales
  let rows = 0;
  let cols = 0;
  let grid = [], nextGrid = [];
  let running = false, drawingMode = false;
  let cyclesPerSec = +speedInput.value || 60;
  let lastFrameTime = 0, generation = 0;
  let animationFrameId = null;
  const wrapEdges = true;
  let cachedDead = colordead.value, cachedAlive = coloralive.value;
  let isMouseDown = false; // état pour dessiner en maintenant le clic
  let lastPaintedKey = null; // évite de repeindre la même case à répétition pendant le glisser

  // ⚙️ Initialisation
  const resizeCanvas = () => {
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
  };

  const createGrid = (empty = true) => {
    grid = Array.from({ length: rows }, () => Array(cols).fill(0));
    nextGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
    if (!empty) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      grid[r][c] = Math.random() < 0.5 ? 1 : 0;
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
    for (const [r, c] of shape)
      if (grid[r + offR] && grid[r + offR][c + offC] !== undefined)
        grid[r + offR][c + offC] = 1;
  };

  // 🎨 Dessin
  const drawCell = (r, c, state) => {
    ctx.fillStyle = state ? cachedAlive : cachedDead;
    ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
  };

  const drawGrid = (changes) => {
    if (!changes) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          drawCell(r, c, grid[r][c]);
    } else {
      for (const [r, c, s] of changes) drawCell(r, c, s);
    }
  };

  // 🧮 Logique du jeu
  const countNeighbors = (r, c) => {
    let count = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (!i && !j) continue;
      let x = r + i, y = c + j;
      if (wrapEdges) {
        x = (x + rows) % rows;
        y = (y + cols) % cols;
      } else if (x < 0 || y < 0 || x >= rows || y >= cols) continue;
      count += grid[x][y];
    }
    return count;
  };

  const nextGeneration = () => {
    const changes = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const n = countNeighbors(r, c);
      const newState = grid[r][c] ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      nextGrid[r][c] = newState;
      if (newState !== grid[r][c]) changes.push([r, c, newState]);
    }
    [grid, nextGrid] = [nextGrid, grid];
    generation++;
    return changes;
  };

  // 🌀 Boucle principale
  const renderLoop = (t) => {
    if (!running) return;
    if (!lastFrameTime) lastFrameTime = t;
    const elapsed = t - lastFrameTime, interval = 1000 / cyclesPerSec;
    if (elapsed >= interval) {
      lastFrameTime = t - (elapsed % interval);
      let map = new Map();
      const iterations = Math.floor(elapsed / interval);
      for (let i = 0; i < iterations; i++) {
        const ch = nextGeneration();
        for (const [r, c, s] of ch) map.set(`${r},${c}`, s);
      }
      const changes = [...map.entries()].map(([k, s]) => {
        const [r, c] = k.split(",").map(Number);
        return [r, c, s];
      });
      drawGrid(changes);
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
    if (grid[y] && grid[y][x] !== undefined) {
      grid[y][x] = grid[y][x] ? 0 : 1;
      drawCell(y, x, grid[y][x]);
    }
  });

  // Maintien du clic + déplacement pour dessiner en continu (pose des cellules vivantes)
  canvas.addEventListener("mousedown", (e) => {
    if (!drawingMode) return;
    isMouseDown = true;
    lastPaintedKey = null;
    const { x, y } = getCellFromEvent(e);
    if (grid[y] && grid[y][x] !== undefined) {
      grid[y][x] = 1;
      drawCell(y, x, 1);
      lastPaintedKey = `${x},${y}`;
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!drawingMode || !isMouseDown) return;
    const { x, y } = getCellFromEvent(e);
    const key = `${x},${y}`;
    if (key === lastPaintedKey) return;
    if (grid[y] && grid[y][x] !== undefined) {
      grid[y][x] = 1;
      drawCell(y, x, 1);
      lastPaintedKey = key;
    }
  });

  const stopDrawing = () => { isMouseDown = false; lastPaintedKey = null; };
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseleave", stopDrawing);

  // 🎚️ Inputs
  speedInput.oninput = () => cyclesPerSec = +speedInput.value || 1;
  colordead.oninput = () => { cachedDead = colordead.value; drawGrid(); };
  coloralive.oninput = () => { cachedAlive = coloralive.value; drawGrid(); };

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