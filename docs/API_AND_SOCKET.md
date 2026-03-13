# API & WebSocket Contract

## REST API

### Health

- `GET /api/health`
  - 200: `{ status, timestamp }`

### Auth

- `POST /api/auth/register`
  - body: `{ username, email, password }`
  - 201: `{ user, token }`
  - 400/409: validation or duplicate errors

- `POST /api/auth/login`
  - body: `{ email, password }`
  - 200: `{ user, token }`
  - 400/401: invalid credentials

### Protected

- `GET /api/protected`
  - header: `Authorization: Bearer <token>`
  - 200: protected payload
  - 401: missing/invalid token

## WebSocket Events

### Client -> Server

- `room:join`
  - payload: `{ roomId }`

### Server -> Client

- `room:joined`
  - payload: `{ roomId, players }`
- `room:player_joined`
  - payload: `{ socketId }`
- `room:player_left`
  - payload: `{ socketId }`
- `room:error`
  - payload: `{ message }`
