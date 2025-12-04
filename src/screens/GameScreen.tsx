// src/screens/GameScreen.tsx
import {
  useEffect,
  useState,
  useRef,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { LEVELS } from "../levels";

type GameScreenProps = {
  onBackToMenu: () => void;
};

type Position = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right" | null;

type Ghost = {
  id: string;
  position: Position;
  direction: Direction;
  color: string;
};

type GameState = {
  levelIndex: number;
  grid: string[];
  pacman: Position;
  direction: Direction;
  nextDirection: Direction;
  score: number;
  lives: number;
  remainingDots: number;
  hasWon: boolean;
  ghosts: Ghost[];
  isGameOver: boolean;
  ghostStepCounter: number;
  respawnCooldownMs: number;
  isFrightened: boolean;
  frightTimerMs: number;
};

type TouchInfo = {
  id: number;
  startX: number;
  startY: number;
  lastDirection: Direction;
};

const TILE_SIZE = 24;
const STEP_MS = 120;
const GHOST_STEP_NORMAL = 3;
const GHOST_STEP_FRIGHTENED = 4;
const SWIPE_THRESHOLD_PX = 10;

const FRIGHT_DURATION_MS = 12000; // 12s de power
const FRIGHT_WARNING_MS = 3000;   // dernières secondes clignotantes

const directionFromKey: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// musiques de fond : public/sounds/level1.wav, level2.wav, ...
const MUSIC_BY_LEVEL = ["level1", "level2", "level3", "level4", "level5"];

// --------- helpers son ---------
let soundMuted = false;
const setSoundMuted = (value: boolean) => {
  soundMuted = value;
};

const playSound = (name: string) => {
  if (soundMuted) return;
  try {
    const base = import.meta.env.BASE_URL || "/";
    const audio = new Audio(`${base}sounds/${name}.wav`);
    audio.volume = 0.5;
    void audio.play();
  } catch {
    // on ignore si le navigateur bloque
  }
};

// --------- helpers de niveau / grille ---------
const createInitialGrid = (levelIndex: number): string[] => {
  const level = LEVELS[levelIndex];
  // on enlève juste P, on garde ., O, #, G
  return level.map((row) => row.replace("P", " "));
};

const findInitialPacman = (levelIndex: number): Position => {
  const level = LEVELS[levelIndex];
  for (let y = 0; y < level.length; y++) {
    const row = level[y];
    const x = row.indexOf("P");
    if (x !== -1) return { x, y };
  }
  return { x: 1, y: 1 };
};

const countDots = (grid: string[]): number =>
  grid.reduce(
    (acc, row) =>
      acc +
      row.split("").filter((c) => c === "." || c === "O").length,
    0
  );

const GHOST_COLORS = ["#ff4b4b", "#ff8bd8", "#ffb84b", "#4bff7a"];
const GHOST_IDS = ["blinky", "pinky", "inky", "clyde"];

const createInitialGhosts = (levelIndex: number): Ghost[] => {
  const level = LEVELS[levelIndex];
  const ghosts: Ghost[] = [];
  let idx = 0;

  for (let y = 0; y < level.length; y++) {
    const row = level[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "G") {
        const id = GHOST_IDS[idx] ?? `ghost${idx}`;
        const color = GHOST_COLORS[idx % GHOST_COLORS.length];
        ghosts.push({
          id,
          position: { x, y },
          direction: "left",
          color,
        });
        idx++;
      }
    }
  }

  return ghosts;
};

const canMoveToInGrid = (grid: string[], x: number, y: number): boolean => {
  if (y < 0 || y >= grid.length) return false;
  if (x < 0 || x >= grid[y].length) return false;
  return grid[y][x] !== "#";
};

const oppositeDirection = (dir: Direction): Direction => {
  if (dir === "up") return "down";
  if (dir === "down") return "up";
  if (dir === "left") return "right";
  if (dir === "right") return "left";
  return null;
};

const moveGhostRandomly = (ghost: Ghost, grid: string[]): Ghost => {
  const { position, direction } = ghost;
  const candidates: { dir: Direction; x: number; y: number }[] = [];

  const tryDir = (dir: Direction, dx: number, dy: number) => {
    const nx = position.x + dx;
    const ny = position.y + dy;
    if (canMoveToInGrid(grid, nx, ny)) {
      candidates.push({ dir, x: nx, y: ny });
    }
  };

  tryDir("up", 0, -1);
  tryDir("down", 0, 1);
  tryDir("left", -1, 0);
  tryDir("right", 1, 0);

  if (candidates.length === 0) return ghost;

  const opp = oppositeDirection(direction);
  const filtered =
    direction && candidates.length > 1
      ? candidates.filter((c) => c.dir !== opp)
      : candidates;

  const options = filtered.length > 0 ? filtered : candidates;
  const choice = options[Math.floor(Math.random() * options.length)];

  return {
    ...ghost,
    position: { x: choice.x, y: choice.y },
    direction: choice.dir,
  };
};

const makeInitialState = (levelIndex: number): GameState => {
  const grid = createInitialGrid(levelIndex);
  return {
    levelIndex,
    grid,
    pacman: findInitialPacman(levelIndex),
    direction: null,
    nextDirection: null,
    score: 0,
    lives: 3,
    remainingDots: countDots(grid),
    hasWon: false,
    ghosts: createInitialGhosts(levelIndex),
    isGameOver: false,
    ghostStepCounter: 0,
    respawnCooldownMs: 0,
    isFrightened: false,
    frightTimerMs: 0,
  };
};

// --------- logique déplacement de Pacman ---------
const movePacmanOnce = (
    dir: Direction,
    pos: Position,
    gridIn: string[],
    scoreIn: number,
    dotsIn: number,
    fright: boolean,
    frightMs: number
  ) => {
    if (!dir) {
      return {
        moved: false,
        pos,
        grid: gridIn,
        score: scoreIn,
        dots: dotsIn,
        isFrightened: fright,
        frightTimer: frightMs,
      };
    }
  
    let dx = 0;
    let dy = 0;
    if (dir === "up") dy = -1;
    if (dir === "down") dy = 1;
    if (dir === "left") dx = -1;
    if (dir === "right") dx = 1;
  
    const nx = pos.x + dx;
    const ny = pos.y + dy;
  
    if (!canMoveToInGrid(gridIn, nx, ny)) {
      return {
        moved: false,
        pos,
        grid: gridIn,
        score: scoreIn,
        dots: dotsIn,
        isFrightened: fright,
        frightTimer: frightMs,
      };
    }
  
    let newGrid = gridIn;
    let newScore = scoreIn;
    let newDots = dotsIn;
    let frightened = fright;
    let frightenedMs = frightMs;
  
    const cell = gridIn[ny][nx];
  
    // ⚡ Gestion des sons :
    // - si pastille -> eat
    // - si super pastille -> power
    // - sinon -> simple déplacement (move)
    if (cell === ".") {
      newScore += 10;
      newDots -= 1;
      playSound("move");
    } else if (cell === "O") {
      newScore += 50;
      newDots -= 1;
      frightened = true;
      frightenedMs = FRIGHT_DURATION_MS;
      playSound("eat");
    } else {
      // aucune pastille : juste le son de déplacement
      playSound("move");
    }
  
    // on vide la case si on a mangé quelque chose
    if (cell === "." || cell === "O") {
      const row = gridIn[ny];
      const newRow = row.substring(0, nx) + " " + row.substring(nx + 1);
      const newArr = [...gridIn];
      newArr[ny] = newRow;
      newGrid = newArr;
    }
  
    return {
      moved: true,
      pos: { x: nx, y: ny },
      grid: newGrid,
      score: newScore,
      dots: newDots,
      isFrightened: frightened,
      frightTimer: frightenedMs,
    };
  };
  

export default function GameScreen({ onBackToMenu }: GameScreenProps) {
  const [state, setState] = useState<GameState>(() => makeInitialState(0));
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const touchInfoRef = useRef<TouchInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const applyDirectionalInput = (dir: Direction) => {
    setState((prev) => {
      if (prev.direction === null) {
        return { ...prev, direction: dir, nextDirection: dir };
      }
      if (prev.nextDirection === dir) {
        return prev;
      }
      return { ...prev, nextDirection: dir };
    });
  };

  const releaseDirectionalInput = (dir: Direction | null) => {
    if (!dir) return;

    setState((prev) => {
      if (prev.direction === dir && prev.nextDirection === dir) {
        return { ...prev, direction: null, nextDirection: null };
      }
      return prev;
    });
  };

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    if (!touch) return;

    touchInfoRef.current = {
      id: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      lastDirection: null,
    };
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    const info = touchInfoRef.current;
    if (!info) return;

    const activeTouch = Array.from(e.changedTouches).find(
      (t) => t.identifier === info.id
    );
    if (!activeTouch) return;

    const dx = activeTouch.clientX - info.startX;
    const dy = activeTouch.clientY - info.startY;

    if (
      Math.abs(dx) < SWIPE_THRESHOLD_PX &&
      Math.abs(dy) < SWIPE_THRESHOLD_PX
    ) {
      return;
    }

    const dir: Direction =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
        ? "down"
        : "up";

    if (dir && dir !== info.lastDirection) {
      applyDirectionalInput(dir);
      touchInfoRef.current = {
        id: info.id,
        startX: activeTouch.clientX,
        startY: activeTouch.clientY,
        lastDirection: dir,
      };
    } else if (dir && dir === info.lastDirection) {
      touchInfoRef.current = {
        ...info,
        startX: activeTouch.clientX,
        startY: activeTouch.clientY,
      };
    }

  };

  const handleTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const info = touchInfoRef.current;
    if (!info) return;

    const ended = Array.from(e.changedTouches).some(
      (t) => t.identifier === info.id
    );
    if (!ended) return;

    releaseDirectionalInput(info.lastDirection);
    touchInfoRef.current = null;
  };

  const handleVirtualButton = (dir: Direction) => (
    e?: { preventDefault?: () => void }
  ) => {
    e?.preventDefault?.();
    if (!dir) return;
    applyDirectionalInput(dir);
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  // =======================
  // Musique de fond par niveau
  // =======================
  useEffect(() => {
    const base = import.meta.env.BASE_URL || "/";

    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current = null;
    }

    const key = MUSIC_BY_LEVEL[state.levelIndex];
    if (!key) return;

    const audio = new Audio(`${base}sounds/${key}.wav`);
    audio.loop = true;
    audio.volume = 0.35;
    audio.muted = isMuted;
    musicRef.current = audio;

    audio.play().catch(() => {});

    return () => {
      audio.pause();
    };
  }, [state.levelIndex, isMuted]);

  useEffect(() => {
    setSoundMuted(isMuted);
    if (musicRef.current) {
      musicRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // =======================
  // Clavier (flèches + cheat 1–5)
  // =======================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // cheat niveau direct
      if (e.key >= "1" && e.key <= "5") {
        const targetIndex = Number(e.key) - 1;

        setState((prev) => {
          if (targetIndex < 0 || targetIndex >= LEVELS.length) return prev;

          const newGrid = createInitialGrid(targetIndex);
          return {
            ...prev,
            levelIndex: targetIndex,
            grid: newGrid,
            pacman: findInitialPacman(targetIndex),
            direction: null,
            nextDirection: null,
            remainingDots: countDots(newGrid),
            ghosts: createInitialGhosts(targetIndex),
            hasWon: false,
            isGameOver: false,
            ghostStepCounter: 0,
            respawnCooldownMs: 0,
            isFrightened: false,
            frightTimerMs: 0,
          };
        });

        return;
      }

      const dir = directionFromKey[e.key];
      if (!dir) return;

      e.preventDefault();

      setState((prev) => {
        if (prev.direction === null) {
          return { ...prev, direction: dir, nextDirection: dir };
          }
        return { ...prev, nextDirection: dir };
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const dir = directionFromKey[e.key];
      if (!dir) return;

      setState((prev) => {
        if (prev.direction === dir && prev.nextDirection === dir) {
          return { ...prev, direction: null, nextDirection: null };
        }
        return prev;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // =======================
  // Boucle de jeu
  // =======================
  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((prev) => {
        const {
          levelIndex,
          grid,
          pacman,
          direction,
          nextDirection,
          score,
          lives,
          remainingDots,
          hasWon,
          ghosts,
          isGameOver,
          ghostStepCounter,
          respawnCooldownMs,
          isFrightened,
          frightTimerMs,
        } = prev;

        if (hasWon || isGameOver) return prev;

        // cooldown après perte de vie
        if (respawnCooldownMs > 0) {
          const remaining = Math.max(0, respawnCooldownMs - STEP_MS);
          return { ...prev, respawnCooldownMs: remaining };
        }

        // copies mutables
        let nextGrid = grid;
        let nextPacman = pacman;
        let nextDir = direction;
        const nextNextDir = nextDirection;
        let nextScore = score;
        let nextDots = remainingDots;
        let nextGhosts = ghosts;
        const nextLives = lives;
        let nextGhostStepCounter = ghostStepCounter;
        let nextIsFrightened = isFrightened;
        let nextFrightTimer = frightTimerMs;

        // timer frightened
        if (nextIsFrightened) {
          nextFrightTimer = Math.max(0, nextFrightTimer - STEP_MS);
          if (nextFrightTimer <= 0) {
            nextIsFrightened = false;
          }
        }

        // 1) Pacman : priorité à nextDirection
        if (nextDirection) {
          const res = movePacmanOnce(
            nextDirection,
            nextPacman,
            nextGrid,
            nextScore,
            nextDots,
            nextIsFrightened,
            nextFrightTimer
          );
          if (res.moved) {
            nextDir = nextDirection;
            nextPacman = res.pos;
            nextGrid = res.grid;
            nextScore = res.score;
            nextDots = res.dots;
            nextIsFrightened = res.isFrightened;
            nextFrightTimer = res.frightTimer;
          }
        }

        // 2) sinon continuer dans la direction en cours
        if (!nextDirection && direction) {
          const res = movePacmanOnce(
            direction,
            nextPacman,
            nextGrid,
            nextScore,
            nextDots,
            nextIsFrightened,
            nextFrightTimer
          );
          if (res.moved) {
            nextPacman = res.pos;
            nextGrid = res.grid;
            nextScore = res.score;
            nextDots = res.dots;
            nextIsFrightened = res.isFrightened;
            nextFrightTimer = res.frightTimer;
          }
        }

        const resetAfterDeath = (livesAfter: number) => {
          const over = livesAfter <= 0;
          const newGrid = createInitialGrid(levelIndex);
          const dots = countDots(newGrid);
          playSound("death");

          return {
            ...prev,
            grid: newGrid,
            pacman: findInitialPacman(levelIndex),
            direction: null,
            nextDirection: null,
            score: nextScore,
            lives: livesAfter,
            remainingDots: dots,
            hasWon: false,
            ghosts: createInitialGhosts(levelIndex),
            isGameOver: over,
            ghostStepCounter: 0,
            respawnCooldownMs: over ? 0 : 1500,
            isFrightened: false,
            frightTimerMs: 0,
          };
        };

        const collideWithPacman = (g: Ghost) =>
          g.position.x === nextPacman.x && g.position.y === nextPacman.y;

        // 3) collision après mouvement de Pacman
        const hitAfterPacman = nextGhosts.some(collideWithPacman);
        if (hitAfterPacman) {
          if (nextIsFrightened) {
            // mange fantôme
            nextGhosts = nextGhosts.filter((g) => !collideWithPacman(g));
            nextScore += 200;
            playSound("ghost");
          } else {
            const livesAfter = nextLives - 1;
            return resetAfterDeath(livesAfter);
          }
        }

        // 4) déplacement des fantômes
        nextGhostStepCounter += 1;
        const ghostStepThreshold = nextIsFrightened
          ? GHOST_STEP_FRIGHTENED
          : GHOST_STEP_NORMAL;

        if (nextGhostStepCounter >= ghostStepThreshold) {
          nextGhosts = nextGhosts.map((g) => moveGhostRandomly(g, nextGrid));
          nextGhostStepCounter = 0;
        }

        // 5) collision après mouvement des fantômes
        const hitAfterGhosts = nextGhosts.some(collideWithPacman);
        if (hitAfterGhosts) {
          if (nextIsFrightened) {
            nextGhosts = nextGhosts.filter((g) => !collideWithPacman(g));
            nextScore += 200;
            playSound("ghost");
          } else {
            const livesAfter = nextLives - 1;
            return resetAfterDeath(livesAfter);
          }
        }

        // 6) victoire
        const hasWonAfter = nextDots <= 0;

        return {
          levelIndex,
          grid: nextGrid,
          pacman: nextPacman,
          direction: nextDir,
          nextDirection: nextNextDir,
          score: nextScore,
          lives: nextLives,
          remainingDots: nextDots,
          hasWon: hasWonAfter,
          ghosts: nextGhosts,
          isGameOver,
          ghostStepCounter: nextGhostStepCounter,
          respawnCooldownMs: respawnCooldownMs,
          isFrightened: nextIsFrightened,
          frightTimerMs: nextFrightTimer,
        };
      });
    }, STEP_MS);

    return () => window.clearInterval(interval);
  }, []);

  const {
    levelIndex,
    grid,
    pacman,
    score,
    lives,
    hasWon,
    ghosts,
    isGameOver,
    isFrightened,
    frightTimerMs,
  } = state;

  const isFrightEnding =
    isFrightened && frightTimerMs <= FRIGHT_WARNING_MS;

  const handleNextLevel = () => {
    setState((prev) => {
      const nextLevel =
        prev.levelIndex < LEVELS.length - 1
          ? prev.levelIndex + 1
          : prev.levelIndex;

      const newGrid = createInitialGrid(nextLevel);
      return {
        ...prev,
        levelIndex: nextLevel,
        grid: newGrid,
        pacman: findInitialPacman(nextLevel),
        direction: null,
        nextDirection: null,
        remainingDots: countDots(newGrid),
        hasWon: false,
        ghosts: createInitialGhosts(nextLevel),
        isGameOver: false,
        ghostStepCounter: 0,
        respawnCooldownMs: 0,
        isFrightened: false,
        frightTimerMs: 0,
      };
    });
  };

  const handleRestart = () => {
    setState(() => makeInitialState(0));
  };

  return (
    <div className="screen center">
      <h1 className="game-title">
        PACMAN RETRO – Level {levelIndex + 1}/{LEVELS.length}
      </h1>

      <div className="game-hud">
        <span>SCORE : {score}</span>
        <span className="game-lives">VIES : {"❤".repeat(lives)}</span>
        {isFrightened && (
          <span className="game-mode">
            POWER MODE{" "}
            {isFrightEnding ? "(!" : ""} {Math.ceil(frightTimerMs / 1000)}s
            {isFrightEnding ? "!)" : ""}
          </span>
        )}
        <button
          type="button"
          className="sound-toggle"
          onClick={handleToggleMute}
        >
          {isMuted ? "SON COUPÉ" : "SON ON"}
        </button>
      </div>

      <div
        className="grid"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          width: grid[0].length * TILE_SIZE,
          height: grid.length * TILE_SIZE,
        }}
      >
        {grid.map((row, y) =>
          row.split("").map((cell, x) => {
            let className = "tile empty";
            if (cell === "#") className = "tile wall";
            else if (cell === ".") className = "tile dot";
            else if (cell === "O") className = "tile super-dot";

            return (
              <div
                key={`${x}-${y}`}
                className={className}
                style={{
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                  left: x * TILE_SIZE,
                  top: y * TILE_SIZE,
                }}
              />
            );
          })
        )}

        {/* Pacman */}
        <div
          className="pacman"
          style={{
            width: TILE_SIZE,
            height: TILE_SIZE,
            transform: `translate(${pacman.x * TILE_SIZE}px, ${
              pacman.y * TILE_SIZE
            }px)`,
          }}
        />

        {/* Fantômes */}
        {ghosts.map((g) => (
          <div
            key={g.id}
            className={
              "ghost" +
              (isFrightened
                ? isFrightEnding
                  ? " ghost-frightened blinking"
                  : " ghost-frightened"
                : "")
            }
            style={{
              width: TILE_SIZE,
              height: TILE_SIZE,
              transform: `translate(${g.position.x * TILE_SIZE}px, ${
                g.position.y * TILE_SIZE
              }px)`,
              backgroundColor: isFrightened ? "#4bffff" : g.color,
            }}
          />
        ))}

        {/* Overlay WIN */}
        {hasWon && !isGameOver && (
          <div className="overlay">
            <div className="overlay-box">
              <h2>YOU WIN!</h2>
              <p>Niveau {levelIndex + 1} complété</p>
              <button onClick={handleNextLevel}>Next level</button>
              <button onClick={onBackToMenu}>Retour au menu</button>
            </div>
          </div>
        )}

        {/* Overlay GAME OVER */}
        {isGameOver && (
          <div className="overlay">
            <div className="overlay-box">
              <h2>GAME OVER</h2>
              <p>Score : {score}</p>
              <button onClick={handleRestart}>Restart (niveau 1)</button>
              <button onClick={onBackToMenu}>Retour au menu</button>
            </div>
          </div>
        )}
      </div>

      <div className="touch-controls" aria-label="Contrôles tactiles">
        <div className="touch-placeholder" />
        <button
          type="button"
          className="touch-btn"
          aria-label="Monter"
          onPointerDown={handleVirtualButton("up")}
        >
          UP
        </button>
        <div className="touch-placeholder" />
        <button
          type="button"
          className="touch-btn"
          aria-label="Aller à gauche"
          onPointerDown={handleVirtualButton("left")}
        >
          LEFT
        </button>
        <div className="touch-placeholder" />
        <button
          type="button"
          className="touch-btn"
          aria-label="Aller à droite"
          onPointerDown={handleVirtualButton("right")}
        >
          RIGHT
        </button>
        <div className="touch-placeholder" />
        <button
          type="button"
          className="touch-btn"
          aria-label="Descendre"
          onPointerDown={handleVirtualButton("down")}
        >
          DOWN
        </button>
        <div className="touch-placeholder" />
      </div>

      <button onClick={onBackToMenu}>Retour au menu</button>
    </div>
  );
}
