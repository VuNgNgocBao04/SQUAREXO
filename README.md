# SQUAREXO

SQUAREXO là game chiến thuật đối kháng 1v1 thuộc hệ sinh thái Oasis, kết hợp lối chơi bàn cờ, xử lý thời gian thực và định hướng tích hợp các thành phần Web3 trên Oasis Network.

Repository này được tổ chức theo kiến trúc fullstack tách biệt frontend và backend, sẵn sàng để mở rộng tính năng gameplay, matchmaking, xếp hạng và tích hợp blockchain.

## Công nghệ sử dụng

- Frontend: React + Vite, Redux Toolkit, Socket.IO Client, Axios
- Backend: Node.js + Express, Socket.IO, MongoDB + Mongoose, JWT
- DevOps & Quality: ESLint, Prettier, Husky + lint-staged, Docker, GitHub Actions

## Cấu trúc dự án

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

## Yêu cầu môi trường

- Node.js 22+
- npm 10+
- MongoDB local hoặc MongoDB Atlas

## Biến môi trường

Sao chép file mẫu và tạo cấu hình cho backend:

```bash
cp .env.example server/.env
```

Các biến quan trọng:

- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_ORIGIN`

## Cài đặt dependencies

```bash
npm ci
npm --prefix client ci
npm --prefix server ci
```

## Chạy môi trường phát triển

Chạy đồng thời frontend và backend từ thư mục gốc:

```bash
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:5000`

## Kiểm tra chất lượng mã nguồn

```bash
npm run lint
npm run format
```

Pre-commit hook đã được bật bằng Husky và lint-staged.

## Chạy bằng Docker

```bash
docker-compose up --build
```

Các service:

- Client: `http://localhost:5173`
- Server: `http://localhost:5000`
- MongoDB: `mongodb://localhost:27017`

## Kiểm thử API nhanh (Postman)

1. `POST /api/auth/register`
2. `POST /api/auth/login`
3. `GET /api/protected` với header `Authorization: Bearer <token>`

## Kiểm thử WebSocket nhanh

- Kết nối Socket.IO tới server
- Emit `room:join` với payload `{ "roomId": "room-1" }`
- Nhận các event `room:joined`, `room:player_joined`, `room:player_left`

## Tài liệu liên quan

- Kiến trúc và quy ước code: `docs/ARCHITECTURE.md`
- Đặc tả API và WebSocket: `docs/API_AND_SOCKET.md`
