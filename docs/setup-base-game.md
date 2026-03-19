# Setup Base Game: SQUAREXO

## Muc tieu

Khoi tao monorepo cho SQUAREXO voi cac package:

- `packages/game-core`: TypeScript thuan, chua logic game, khong phu thuoc framework.
- `packages/frontend`: Vite + React + Zustand + Canvas API.
- `packages/backend`: Node.js + Express + Socket.IO.

## Cau truc

```text
squarexo/
|
|- package.json
|- pnpm-workspace.yaml
|
|- packages/
|  |- game-core/
|  |- frontend/
|  \- backend/
|
\- docs/
   \- setup-base-game.md
```

## Buoc tiep theo de bootstrap package

1. Tao `package.json` rieng cho tung package trong `packages/*`.
2. Cai dat dependency theo package.
3. Thiet lap script `dev`, `build`, `test` cho tung package.
4. Ket noi frontend va backend qua Socket.IO.
5. Tach logic game thuần vao `game-core` de dung chung.
