# SQUAREXO

SQUAREXO là project fullstack game 1v1 theo kiến trúc tách `client` và `server`, sẵn sàng để phát triển tính năng gameplay realtime.

## Tech Stack

- Frontend: React + Vite, Redux Toolkit, Socket.IO Client, Axios
- Backend: Node.js + Express, Socket.IO, MongoDB + Mongoose, JWT Auth
- Dev Tools: ESLint, Prettier, Husky + lint-staged, Docker, GitHub Actions

## Project Structure

```text
project/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/
│   │   ├── core/
│   │   ├── hooks/
│   │   └── utils/
│   └── public/
├── server/
│   ├── src/
│   │   ├── models/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── sockets/
│   │   └── utils/
│   └── config/
├── docs/
├── docker-compose.yml
└── README.md
```

## Prerequisites

- Node.js 22+
- npm 10+
- MongoDB local (hoặc MongoDB Atlas)

## Environment Variables

Copy `.env.example` and create env file for backend:

```bash
cp .env.example server/.env
```

Giá trị quan trọng:

- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_ORIGIN`

## Install Dependencies

```bash
npm ci
npm --prefix client ci
npm --prefix server ci
```

## Run in Development

Chạy cả frontend + backend cùng lúc từ root:

```bash
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:5000`

## Lint / Format

```bash
npm run lint
npm run format
```

Pre-commit hook đã bật qua Husky + lint-staged.

## Docker

```bash
docker-compose up --build
```

Services:

- Client: `http://localhost:5173`
- Server: `http://localhost:5000`
- MongoDB: `mongodb://localhost:27017`

## API Quick Test (Postman)

1. `POST /api/auth/register`
2. `POST /api/auth/login`
3. `GET /api/protected` với header `Authorization: Bearer <token>`

## WebSocket Quick Test

- Kết nối Socket.IO tới server
- Emit `room:join` với `{ "roomId": "room-1" }`
- Nhận `room:joined`, `room:player_joined`, `room:player_left`

## Docs

- Kiến trúc và conventions: `docs/ARCHITECTURE.md`
- API + WebSocket contract: `docs/API_AND_SOCKET.md`
