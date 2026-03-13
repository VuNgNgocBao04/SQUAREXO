# SQUAREXO Architecture & Conventions

## 1. Tech Stack

- Frontend: React + Vite, Canvas API (planned), Redux Toolkit, Socket.IO Client, Axios
- Backend: Node.js + Express, Socket.IO, MongoDB + Mongoose, JWT Auth
- Tooling: ESLint, Prettier, Husky + lint-staged, Docker, GitHub Actions

## 2. Repository Architecture

- `client/`: React app
- `server/`: Express + Socket.IO backend
- `docs/`: architecture, API and event contracts

## 3. Naming & Coding Conventions

- Files/components: `PascalCase` for React component files (`HomePage.jsx`)
- Variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Route path: `kebab-case`
- Socket event names: `domain:action` (e.g. `room:join`, `room:joined`)
- Keep pure game logic inside `client/src/core` and avoid side effects in reducers

## 4. Database Design (Phase 1 + 2 Ready)

### User

- `username` (unique)
- `email` (unique)
- `passwordHash`
- `rating`

### GameState

- `boardSize`
- `cells`
- `edges`
- `squares`
- `currentTurn`
- `status`

### Match

- `roomId` (unique)
- `players[]`: `{ user, symbol }`
- `gameState` reference
- `winner` reference
- `status`

## 5. Redux Store Structure

- `auth` slice
  - `user`, `token`, `isAuthenticated`
- `game` slice
  - `currentRoomId`, `board`, `turn`, `status`
