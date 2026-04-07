# 🚀 Guia Integração Backend-Frontend - SQUAREXO Multiplayer

## ✅ Integração Completada

### 1️⃣ Autenticação com JWT

**Backend (`src/server.ts`):**
- ✅ Socket.io middleware para validar JWT token
- ✅ Token extraído de `socket.handshake.auth.token`
- ✅ Rejeita conexões sem token válido

**Frontend (`src/services/auth.ts`):**
- ✅ Função `register()` - cria conta e retorna JWT token
- ✅ Função `login()` - autentica e armazena token
- ✅ Função `getAccessToken()` - recupera token do localStorage
- ✅ Função `isAuthenticated()` - verifica se usuário logado

**App.tsx:**
- ✅ Integrado com `authService` para login/register real
- ✅ Rotas agora usam token JWT do backend
- ✅ Logout limpa tokens e session

### 2️⃣ Socket.io com Autenticação

**OnlineMultiplayerPanel.tsx:**
- ✅ Autenticação via token JWT no handshake:
```typescript
const socket = io(BACKEND_URL, {
  auth: { token: getAccessToken() },
  transports: ['websocket'],
  reconnection: true,
});
```

### 3️⃣ Criação e Entrada em Salas

**Frontend:**
- ✅ Botão "🌐 Online 2 Pessoas" leva para tela de sala
- ✅ Opção "TẠO PHÒNG" - gera roomId aleatório
- ✅ Opção "VÀO PHÒNG" - permite enter código 6 dígitos
- ✅ Código de sala sempre visível para compartilhar

**Backend:**
- ✅ Room management com `RoomManager`
- ✅ Suporta até 2 players por sala
- ✅ Limpeza automática de salas vazias
- ✅ Sincronização de game state

### 4️⃣ Sincronização Real-Time

**Eventos Socket.io:**

| Evento | Direção | Payload |
|--------|---------|---------|
| `join_room` | Client → Server | `{ roomId, rows, cols, playerId }` |
| `room_info` | Server → Client | `{ roomId, playerX, playerO, isFull, assignedPlayer }` |
| `make_move` | Client → Server | `{ roomId, edge, actionId, clientSequence }` |
| `game_state` | Server → Client | `{ state, currentPlayer }` |
| `player_joined` | Server → Client | Notificação quando 2º player entra |
| `sync_state` | Client → Server | Sincroniza estado atual |

## 🧪 Como Testar

### Pré-requisitos
- Node.js v18+
- 2 navegadores/abas diferentes (ou 2 máquinas)

### Passo 1: Iniciar Backend

```bash
cd packages/backend
npm install
npm run dev
```

**Esperado:**
```
{"ts":"2026-04-07...","level":"info","msg":"backend_started","port":3000}
```

### Passo 2: Iniciar Frontend

Em outro terminal:
```bash
cd packages/frontend  
npm install
npm run dev
```

**Esperado:**
```
VITE v5.0.0  ready in XXX ms
➜  Local:   http://localhost:5173/
```

### Passo 3: Registrar Usuários

**Player 1:**
1. Abra http://localhost:5173
2. Clique "ĐĂNG KÝ"
3. Preencha:
   - Username: `player1`
   - Email: `player1@test.com`
   - Password: `test123456`
4. Clique "⚡ ĐĂNG KÝ"

**Player 2:**
1. Abra http://localhost:5173 em **outra aba/navegador**
2. Clique "ĐĂNG KÝ"
3. Preencha:
   - Username: `player2`
   - Email: `player2@test.com`
   - Password: `test123456`
4. Clique "⚡ ĐĂNG KÝ"

### Passo 4: Criar e Entrar em Sala

**Player 1 (criar sala):**
1. Home → Clique "🌐 Online 2 Người"
2. Clique "⚡ TẠO PHÒNG"
3. Copie o **Mã Phòng** (ex: `ROOM123`)

**Player 2 (entrar sala):**
1. Home → Clique "🌐 Online 2 Người"
2. Cole o código em "🔑 Vào Phòng"
3. Clique "Vào →"

### Passo 5: Começar Jogo

**Esperado:**
- Ambos veem the same board
- Player 1 começa (X)
- Player 2 é O
- Countdown 3-2-1 antes de iniciar
- Placar sincronizado em tempo real

### Passo 6: Fazer Movimentos

**Player 1:**
- Clique nas linhas vazias para conectar pontos
- Observe Player 2 receber o movimento em tempo real

**Player 2:**
- Depois que Player 1 fizer seu move
- Clique nas linhas vazias para sua jogada
- Player 1 vê o movimento instantaneamente

**Esperado:**
- ✅ Linhas mudam de cor instantaneamente em ambos
- ✅ Turno alterna automaticamente
- ✅ Pontuação sincroniza
- ✅ Sem lag ou delay

## 🔍 Troubleshooting

### Erro: "Authentication token required"
**Solução:** Verifique se está logado. Se não, faça login novamente.

### Erro: "Room not found"
**Causa:** Código de sala inválido ou expirado
**Solução:** Crie uma nova sala

### Movimentos não sincronizam
**Checklist:**
1. Ambos usam a mesma `roomId`?
2. Backend rodando em http://localhost:3000?
3. Frontend consegue conectar no WebSocket?
4. Abra DevTools (F12) → Console → verifique erros

**Debug Socket.io:**
```javascript
// No console do navegador
// Player 1
console.log('Room:', localStorage.getItem('squarexo-online-room-id'))
console.log('Player:', sessionStorage.getItem('squarexo-online-player-id'))
```

### Desconexão frequente
**Causas possíveis:**
- Firewall bloqueando WebSocket
- Backend cair
- Conexão internet instável

**Solução:**
1. Reinicie backend: `npm run dev`
2. Atualize a aba do navegador
3. Tente novamente

## 📊 Arquivos Modificados

```
Backend:
✅ src/config/env.ts - adicionado dotenv.config()
✅ src/server.ts - middleware Socket.io auth JWT
✅ .env - JWT_SECRET configurado

Frontend:
✅ src/services/auth.ts - novo arquivo
✅ src/App.tsx - integrado authService
✅ src/components/OnlineMultiplayerPanel.tsx - auth no Socket.io
✅ .env.local - VITE_BACKEND_URL
```

## 🎯 Features Funcionando

- ✅ Registrar conta com email/password
- ✅ Login com JWT token
- ✅ Criar sala com código único
- ✅ Entrar sala usando código
- ✅ Sincronização real-time de movimentos
- ✅ Validação de turnos
- ✅ Placar sincronizado
- ✅ Desconexão reconexão automática
- ✅ Rate limiting (2 moves/segundo)
- ✅ Deduplicação de ações

## 📝 Próximos Passos (Opcional)

- [ ] Salvar histórico de jogos em DB
- [ ] Integrar Wallet Web3 real
- [ ] Adicionar chat via Socket.io
- [ ] Sistema de ranking
- [ ] Modo espectador
- [ ] Replay de jogos
- [ ] Elo rating

---

**Última Atualização:** 07/04/2026
**Status:** ✅ Production Ready
