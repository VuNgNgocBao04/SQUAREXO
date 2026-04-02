# Socket Contract v1

## Inbound events (client -> server)

### `join_room`

Payload:

```json
{
  "roomId": "demo_room_1",
  "rows": 3,
  "cols": 3,
  "playerId": "optional-stable-id"
}
```

Rules:

- `roomId`: 3-64 chars, pattern `[a-zA-Z0-9_-]`
- `rows`, `cols`: optional, integer 1..12
- `playerId`: optional, for reconnect slot recovery

### `make_move`

Payload:

```json
{
  "roomId": "demo_room_1",
  "actionId": "req-001",
  "edge": {
    "from": { "row": 0, "col": 0 },
    "to": { "row": 0, "col": 1 }
  }
}
```

Rules:

- Must come from assigned player in room
- Must be current turn
- `actionId` deduplicated in a time window

### `reset_game`

Payload:

```json
{ "roomId": "demo_room_1" }
```

Rules:

- Only assigned player can reset

### `sync_state`

Payload:

```json
{ "roomId": "demo_room_1" }
```

Use case:

- reconnect/new join request latest server snapshot

## Outbound events (server -> client)

### `room_info`

```json
{
  "roomId": "demo_room_1",
  "playerX": "player-id-or-null",
  "playerO": "player-id-or-null",
  "assignedPlayer": "X",
  "isFull": false,
  "boardSize": { "rows": 3, "cols": 3 },
  "roomUrl": "http://localhost:3000/?room=demo_room_1"
}
```

### `game_state`

```json
{
  "roomId": "demo_room_1",
  "state": { "rows": 3, "cols": 3, "edges": [], "currentPlayer": "X", "score": { "X": 0, "O": 0 } },
  "currentPlayer": "X"
}
```

### `player_joined`

Payload is the same shape as `room_info`.

Emitted when another socket joins the same room.

### `room_cleaned`

```json
{
  "roomId": "demo_room_1"
}
```

Emitted when a room becomes empty and is removed.

### `error`

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid payload",
  "metadata": {
    "issues": [{ "path": "edge.from.col", "message": "Required" }]
  }
}
```

Error code list:

- `VALIDATION_ERROR`
- `ROOM_NOT_FOUND`
- `ROOM_FULL`
- `NOT_IN_ROOM`
- `NOT_YOUR_TURN`
- `INVALID_MOVE`
- `EDGE_ALREADY_TAKEN`
- `RESET_FORBIDDEN`
- `INTERNAL_ERROR`
