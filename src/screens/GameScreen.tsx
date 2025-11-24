// src/screens/GameScreen.tsx
import { useEffect, useState } from "react";
import { LEVEL_1 } from "../levels/level1";

type GameScreenProps = {
  onBackToMenu: () => void;
};

type Position = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right" | null;

type GameState = {
  grid: string[];
  pacman: Position;
  direction: Direction;
  nextDirection: Direction;
  score: number;
  lives: number;
  remainingDots: number;
  hasWon: boolean;
};

const TILE_SIZE = 24;
const STEP_MS = 120;

const directionFromKey: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const createInitialGrid = (): string[] =>
  LEVEL_1.map((row) => row.replace("P", " "));

const findInitialPacman = (): Position => {
  for (let y = 0; y < LEVEL_1.length; y++) {
    const row = LEVEL_1[y];
    const x = row.indexOf("P");
    if (x !== -1) return { x, y };
  }
  return { x: 1, y: 1 };
};

const countDots = (grid: string[]): number =>
  grid.reduce(
    (acc, row) => acc + row.split("").filter((c) => c === ".").length,
    0
  );

const initialGrid = createInitialGrid();

const initialState: GameState = {
  grid: initialGrid,
  pacman: findInitialPacman(),
  direction: null,
  nextDirection: null,
  score: 0,
  lives: 3,
  remainingDots: countDots(initialGrid),
  hasWon: false,
};

export default function GameScreen({ onBackToMenu }: GameScreenProps) {
  const [state, setState] = useState<GameState>(initialState);

  // ---------- CLAVIER ----------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  // ---------- BOUCLE DE JEU ----------
  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((prev) => {
        const {
          grid,
          pacman,
          direction,
          nextDirection,
          score,
          lives,
          remainingDots,
          hasWon,
        } = prev;

        if (hasWon) {
          return prev;
        }

        const canMoveTo = (x: number, y: number): boolean => {
          if (y < 0 || y >= grid.length) return false;
          if (x < 0 || x >= grid[y].length) return false;
          return grid[y][x] !== "#";
        };

        const moveOnce = (
          dir: Direction,
          pos: Position,
          gridIn: string[],
          scoreIn: number,
          dotsIn: number
        ) => {
          if (!dir) {
            return {
              moved: false,
              pos,
              grid: gridIn,
              score: scoreIn,
              dots: dotsIn,
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

          if (!canMoveTo(nx, ny)) {
            return {
              moved: false,
              pos,
              grid: gridIn,
              score: scoreIn,
              dots: dotsIn,
            };
          }

          let newGrid = gridIn;
          let newScore = scoreIn;
          let newDots = dotsIn;

          const cell = gridIn[ny][nx];
          if (cell === ".") {
            newScore += 10;
            newDots -= 1;

            const row = gridIn[ny];
            const newRow = row.substring(0, nx) + " " + row.substring(nx + 1);
            newGrid = [...gridIn];
            newGrid[ny] = newRow;
          }

          return {
            moved: true,
            pos: { x: nx, y: ny },
            grid: newGrid,
            score: newScore,
            dots: newDots,
          };
        };

        let newDir = direction;
        let newNext = nextDirection;
        let newPos = pacman;
        let newGrid = grid;
        let newScore = score;
        let newDots = remainingDots;

        // 1) priorité à la nextDirection
        if (nextDirection) {
          const res = moveOnce(
            nextDirection,
            newPos,
            newGrid,
            newScore,
            newDots
          );
          if (res.moved) {
            newDir = nextDirection;
            newPos = res.pos;
            newGrid = res.grid;
            newScore = res.score;
            newDots = res.dots;
          }
        }

        // 2) sinon on continue dans la direction actuelle
        if (!hasWon && !nextDirection && direction) {
          const res = moveOnce(direction, newPos, newGrid, newScore, newDots);
          if (res.moved) {
            newPos = res.pos;
            newGrid = res.grid;
            newScore = res.score;
            newDots = res.dots;
          }
        }

        // calcul du nouvel état de victoire
        const won = hasWon || newDots <= 0;

        return {
          grid: newGrid,
          pacman: newPos,
          direction: newDir,
          nextDirection: newNext,
          score: newScore,
          lives,
          remainingDots: newDots,
          hasWon: won,
        };
      });
    }, STEP_MS);

    return () => window.clearInterval(interval);
  }, []);

  const { grid, pacman, score, lives, hasWon } = state;

  const handleNextLevel = () => {
    const newGrid = createInitialGrid();
    setState((prev) => ({
      ...prev,
      grid: newGrid,
      pacman: findInitialPacman(),
      direction: null,
      nextDirection: null,
      remainingDots: countDots(newGrid),
      hasWon: false,
    }));
  };

  return (
    <div className="screen center">
      <h1 className="game-title">PACMAN RETRO</h1>

      <div className="game-hud">
        <span>SCORE : {score}</span>
        <span className="game-lives">VIES : {"❤".repeat(lives)}</span>
      </div>

      <div
        className="grid"
        style={{
          width: grid[0].length * TILE_SIZE,
          height: grid.length * TILE_SIZE,
        }}
      >
        {grid.map((row, y) =>
          row.split("").map((cell, x) => (
            <div
              key={`${x}-${y}`}
              className={
                cell === "#"
                  ? "tile wall"
                  : cell === "."
                  ? "tile dot"
                  : "tile empty"
              }
              style={{
                width: TILE_SIZE,
                height: TILE_SIZE,
                left: x * TILE_SIZE,
                top: y * TILE_SIZE,
              }}
            />
          ))
        )}

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

        {hasWon && (
          <div className="overlay">
            <div className="overlay-box">
              <h2>YOU WIN!</h2>
              <p>Niveau complété</p>
              <button onClick={handleNextLevel}>Next level</button>
              <button onClick={onBackToMenu}>Retour au menu</button>
            </div>
          </div>
        )}
      </div>

      <button onClick={onBackToMenu}>Retour au menu</button>
    </div>
  );
}
