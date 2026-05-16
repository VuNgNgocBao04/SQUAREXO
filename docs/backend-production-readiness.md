# Backend Production Readiness Guide

## Database Setup (PostgreSQL)

### Development Environment

1. **Install PostgreSQL**:
   ```bash
   # macOS
   brew install postgresql@15

   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib

   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

2. **Create Database**:
   ```bash
   createdb squarexo
   psql squarexo < packages/backend/src/db/schema.sql
   ```

3. **Configure `.env`**:
   ```bash
   DATABASE_URL=postgres://postgres:PASSWORD@localhost:5432/squarexo
   DATABASE_POOL_MIN=2
   DATABASE_POOL_MAX=10
   DATABASE_STATEMENT_TIMEOUT_MS=30000
   ```

### Production Deployment

1. **RDS/Aurora Setup**:
   - Use AWS RDS PostgreSQL 15+ or Azure Database for PostgreSQL
   - Enable automated backups (daily, 30-day retention)
   - Enable SSL/TLS for connections
   - Set `max_connections` to 200+ for connection pooling

2. **Connection Pooling**:
   - The driver uses built-in pooling (min: 2, max: 10 configurable)
   - For high concurrency, consider PgBouncer:
     ```bash
     # Increase connection pool limits
     DATABASE_POOL_MAX=50
     ```

3. **Monitoring**:
   - Monitor connection pool usage: `SELECT count(*) FROM pg_stat_activity`
   - Monitor slow queries: enable `log_min_duration_statement = 1000`
   - Monitor table bloat and run VACUUM periodically

## Socket.io Horizontal Scaling

### Sticky Sessions Configuration

For horizontal scaling (multiple backend instances), Socket.io requires sticky sessions to route reconnections to the same server instance.

**1. Load Balancer Configuration (Nginx)**:
```nginx
upstream backend {
    # Use IP hash for sticky sessions
    hash $remote_addr consistent;
    
    server backend-1:3000;
    server backend-2:3000;
    server backend-3:3000;
}

server {
    listen 80;
    server_name api.squarexo.io;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Sticky session via cookie
        proxy_cookie_path / "/";
        proxy_cookie_flags ~ secure httponly;
    }
}
```

**2. Socket.io Adapter (Redis)**:
For true distributed room state, use Redis adapter:
```bash
npm install @socket.io/redis-adapter
```

Update `server.ts`:
```typescript
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const pubClient = createClient({ host: "redis-host", port: 6379 });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

**3. Environment Variables for Scaling**:
```bash
# .env
REDIS_URL=redis://localhost:6379
SOCKET_IO_ADAPTER=redis  # or 'memory' for single instance
```

## Security Hardening

### Authentication & Authorization

1. **JWT Security**:
   - ✅ Token expiration: 7 days (refresh token: 30 days)
   - ✅ JTI (JWT ID) for revocation tracking
   - ✅ Database persistence for token revocation
   - Database cleanup of expired tokens (daily):
     ```bash
     # Add to cron job
     DELETE FROM token_revocations WHERE expires_at < NOW();
     DELETE FROM refresh_tokens WHERE expires_at < NOW();
     ```

2. **Password Security**:
   - ✅ Bcrypt hashing (10 rounds)
   - ✅ Minimum 6 characters, maximum 128 characters
   - Enforce stronger passwords in production:
     ```bash
     # Password requirements: uppercase, lowercase, number, special char
     # Min 12 characters
     ```

3. **Socket.io Authentication**:
   - ✅ JWT validation at handshake
   - ✅ Player identity bound to socket data
   - ✅ Prevents playerId spoofing
   - ✅ Rejects invalid connections

### Rate Limiting

1. **HTTP Endpoints**:
   - Auth endpoints: 10 req/min per IP
   - API endpoints: 100 req/min per IP
   - Configure in production:
     ```bash
     # Use Redis for distributed rate limiting
     RATE_LIMIT_STORE=redis
     ```

2. **Socket.io Events**:
   - Move limit: 2 per second per socket
   - Configured in `socket/handler.ts`

### Database Security

1. **Connection Security**:
   ```bash
   # Use SSL/TLS in production
   DATABASE_URL=postgres://user:pass@host:5432/squarexo?sslmode=require
   ```

2. **User Permissions**:
   ```sql
   -- Create restricted user for app
   CREATE USER squarexo_app WITH ENCRYPTED PASSWORD 'strong_password';
   GRANT CONNECT ON DATABASE squarexo TO squarexo_app;
   GRANT USAGE ON SCHEMA public TO squarexo_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO squarexo_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO squarexo_app;
   ```

## Monitoring & Alerting

### Metrics to Monitor

1. **Application Metrics** (available at `/metrics`):
   - Active sockets
   - Active rooms
   - API request rates
   - Error rates by endpoint

2. **Database Metrics**:
   - Connection pool utilization
   - Query latency
   - Slow queries (> 1s)
   - Transaction count

3. **System Metrics**:
   - Memory usage
   - CPU usage
   - Disk space (for logs)
   - Network I/O

### Health Checks

Liveness probe (k8s/Docker):
```bash
curl http://localhost:3000/health
# Expected: { "status": "healthy", "checks": {...} }
```

Readiness probe:
```bash
curl http://localhost:3000/health
# Only return 200 if database is connected
```

### Logging

Structured JSON logging is configured in `config/logger.ts`:
```bash
# Forward logs to:
# - CloudWatch / Azure Logs / Stackdriver
# - ELK Stack
# - Datadog
# - New Relic
```

Key log events:
- `backend_started`: Server startup
- `socket_authenticated`: Socket connection
- `socket_connected`: New socket connection
- `rate_limit_exceeded`: Rate limit hit
- `auth_failed`: Authentication failure
- `database_error`: Database connectivity issue

## Performance Tuning

### Database

1. **Connection Pool**:
   ```bash
   DATABASE_POOL_MIN=5     # Minimum connections
   DATABASE_POOL_MAX=20    # Maximum connections (adjust for load)
   ```

2. **Indexes**:
   - All indexes created in `schema.sql`
   - Monitor unused indexes: `pg_stat_user_indexes`

3. **Query Optimization**:
   - All queries use prepared statements (pg driver)
   - Run EXPLAIN ANALYZE on slow queries
   - Monitor sequential scans on large tables

### Node.js

1. **Cluster Mode** (optional):
   ```javascript
   // Run multiple instances with PM2
   pm2 start index.ts -i max
   ```

2. **Memory Management**:
   - Monitor heap size: `node --max-old-space-size=2048`
   - Implement graceful shutdown

3. **Connection Management**:
   - Reuse database connections
   - Implement connection timeout recovery
   - Circuit breaker for failing databases

## Deployment Checklist

- [ ] PostgreSQL database created and migrated
- [ ] Connection pooling configured
- [ ] Rate limiting configured
- [ ] JWT secrets rotated and secured
- [ ] Database SSL/TLS enabled
- [ ] Health check endpoint responding
- [ ] Metrics endpoint accessible (consider protecting)
- [ ] Logging configured and forwarding
- [ ] Monitoring and alerting setup
- [ ] Sticky sessions configured (if scaling)
- [ ] Graceful shutdown implemented
- [ ] Database backups configured
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Documentation updated

## Emergency Procedures

### Database Connection Lost

1. **Check connection string**: `psql $DATABASE_URL`
2. **Verify network connectivity**: `ping postgres-host`
3. **Check pool exhaustion**: Monitor `/metrics` active connections
4. **Restart service**: Will reset connection pool

### High Memory Usage

1. Check for leaks: Monitor `/metrics` over time
2. Analyze heap dump: `kill -USR2 <pid>`
3. Review recent changes
4. Restart service if memory >80% of limit

### Rate Limit False Positives

1. **Increase limits** (if legitimate load):
   ```bash
   AUTH_RATE_LIMIT=100  # requests per minute
   API_RATE_LIMIT=1000
   ```

2. **Use Redis adapter** for distributed rate limiting across instances

### Socket.io Connection Issues

1. Verify JWT token expiration
2. Check sticky session configuration
3. Monitor room state for memory leaks
4. Review client reconnection logic

## Additional Resources

- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Socket.io Scaling](https://socket.io/docs/v4/redis-adapter/)
- [Node.js Production Checklist](https://nodejs.org/en/docs/guides/nodejs-performance-monitoring/)
