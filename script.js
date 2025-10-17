document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) {
    console.error("Canvas introuvable : vérifie l'id 'gameCanvas' dans index.html");
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Impossible d'obtenir le context 2D du canvas.");
    return;
  }

  const cellSize = 10;

  // --- Contrôles UI ---
  const heightInput = document.getElementById("height");
  const widthInput = document.getElementById("width");
  const speedInput = document.getElementById("speed");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");

  // --- Variables du jeu ---
  let rows = parseInt(heightInput?.value || 50, 10);
  let cols = parseInt(widthInput?.value || 50, 10);
  let grid = [];
  let intervalId = null;
  let running = false;
  let cyclesPerSec = parseFloat(speedInput?.value || 5);

  // --- Fonctions principales ---
  function resizeCanvas() {
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
  }

  function createGrid(empty = true) {
    grid = new Array(rows);
    for (let r = 0; r < rows; r++) {
      grid[r] = new Array(cols);
      for (let c = 0; c < cols; c++) {
        grid[r][c] = empty ? 0 : (Math.random() < 0.5 ? 1 : 0);
      }
    }
    resizeCanvas();
  }

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = grid[r][c] ? "#fff" : "#000";
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
  }

  function countNeighbors(r, c) {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue;
        const x = r + i, y = c + j;
        if (x >= 0 && x < rows && y >= 0 && y < cols) {
          count += grid[x][y] ? 1 : 0;
        }
      }
    }
    return count;
  }

  function nextGeneration() {
    const newGrid = new Array(rows);
    for (let r = 0; r < rows; r++) {
      newGrid[r] = new Array(cols);
      for (let c = 0; c < cols; c++) {
        const neighbors = countNeighbors(r, c);
        if (grid[r][c]) {
          newGrid[r][c] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
        } else {
          newGrid[r][c] = (neighbors === 3) ? 1 : 0;
        }
      }
    }
    grid = newGrid;
    drawGrid();
  }

  function startSimulation() {
    if (running) return;
    running = true;
    intervalId = setInterval(nextGeneration, 1000 / cyclesPerSec);
  }

  function pauseSimulation() {
    running = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function wipeGrid() {
    createGrid(true);
    drawGrid();
  }

  function randomFill() {
    createGrid(false);
    drawGrid();
  }

  // --- Événements UI ---
  startBtn?.addEventListener("click", () => {
    const newRows = parseInt(heightInput.value || 20, 10);
    const newCols = parseInt(widthInput.value || 20, 10);
    const newSpeed = parseFloat(speedInput.value || 5) || 1;

    cyclesPerSec = newSpeed;

    if (newRows !== rows || newCols !== cols) {
      rows = newRows;
      cols = newCols;
      createGrid(true);
      drawGrid();
    }

    startSimulation();
  });

  pauseBtn?.addEventListener("click", () => {
    pauseSimulation();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "w") wipeGrid();
    else if (ev.key === "r") randomFill();
  });

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor(x / cellSize);
    const r = Math.floor(y / cellSize);
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      grid[r][c] = grid[r][c] ? 0 : 1;
      drawGrid();
    }
  });

  // --- Initialisation par défaut ---
  createGrid(false); // grille aléatoire
  drawGrid();

  // Simulation automatique
  running = true;
  intervalId = setInterval(nextGeneration, 1000 / cyclesPerSec);

  // --- Console debug ---
  window.gameDebug = { wipeGrid, randomFill, nextGeneration, startSimulation, pauseSimulation, createGrid };
  console.log("Jeu de la Vie initialisé : simulation automatique en cours !");
});
