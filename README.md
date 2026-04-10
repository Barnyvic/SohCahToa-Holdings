# Secure Wallet API (NestJS + MySQL + TypeORM)

## Stack
- NestJS, TypeORM, MySQL, class-validator
- JWT access + refresh tokens
- TypeORM migrations
- Redis distributed lock
- Swagger at `/docs` (versioned endpoints under `/v1`)

## Architecture
This project is a **Modular Monolith with Clean Layering**:
- **Presentation layer (controllers):** HTTP contracts only, no business logic.
- **Application/domain layer (services):** business rules, orchestration, idempotency, and transaction safety.
- **Infrastructure layer (TypeORM/repositories):** persistence, locking primitives, and DB access.

Domain modules:
- `auth`: register/login/refresh, JWT issuance
- `users`: user model/service
- `wallet`: wallet read access + admin scope
- `transactions`: debit/credit, idempotency, locking, atomic writes
- `audit-log`: transaction activity log
- `common`: guards/decorators/filter
- `utils/money`: safe decimal arithmetic via `decimal.js`

## Entity Relationships
- User 1:1 Wallet (unique `wallet.user_id`)
- Wallet 1:N Transactions
- Wallet auto-created during registration in same DB transaction

## Setup
```bash
npm install
cp .env.example .env
```

## Docker (Optional but Recommended)
```bash
docker compose up --build -d
```

Then run migrations inside the app container:
```bash
docker compose exec app npm run migration:run
```

API will be available at:
- `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`

## Migration Commands
```bash
npm run build
npm run migration:run
```

## Run
```bash
npm run start:dev
```

## Endpoints
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `GET /v1/wallet`
- `GET /v1/wallet/:userId` (admin only)
- `GET /v1/transactions?page=1&limit=20` (returns `{ data, total, page, limit }`)
- `POST /v1/transactions`

## Idempotency Strategy
- `transactions.idempotency_key` is unique
- Request checks existing record first inside DB transaction (`QueryRunner`)
- Duplicate key returns original transaction; no second mutation
- Crash mid-transaction rolls back all state changes
- Refresh tokens are stateless JWTs, so replay window is constrained with short TTL + strong key management.

## Race Condition Prevention
- DB transaction (`QueryRunner`) for write path
- Wallet row locked with pessimistic write (`FOR UPDATE`)
- Redis lock (`wallet-lock:{walletId}`) adds cross-node safety
- Two debits against balance `150` for `100` => one success, one failed

## Why This Locking Strategy
- I use **DB row-level locking** as the source of truth for correctness because balance consistency must be guaranteed at commit time.
- I add a **Redis distributed lock** to reduce cross-instance contention and duplicate in-flight work in horizontally scaled deployments.
- This layered approach gives:
  - strong consistency from MySQL transaction + `FOR UPDATE`
  - better coordination/performance across multiple app nodes from Redis
  - safe behavior even if one layer degrades (DB lock still protects final correctness)

## Injection Prevention
- TypeORM repository/query-builder parameterized operations only
- DTO validation with strict global pipe (`whitelist`, `forbidNonWhitelisted`)

## OWASP API Top 10 / BOLA
- JWT auth on protected routes
- RBAC (`admin` vs `user`) with `@Roles()` + `RolesGuard`
- All wallet/transaction queries scoped to JWT user id
- Mass assignment prevented via strict DTOs
- Standardized error response via global exception filter
- Sensitive data (password hash) never returned

### OWASP Mapping (Explicit)
| OWASP API Risk | Mitigation in this project |
|---|---|
| API1: Broken Object Level Authorization (BOLA) | Wallet/transaction queries are scoped by JWT `sub`; admin-only access uses `RolesGuard` + `@Roles(UserRole.ADMIN)` |
| API2: Broken Authentication | JWT bearer auth + password hashing (bcrypt) + access/refresh token separation |
| API3: Broken Object Property Level Authorization / Mass Assignment | Strict DTO validation + `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`) prevents client-controlled sensitive fields |
| API4: Unrestricted Resource Consumption | `@nestjs/throttler` global limit and stricter route limits on auth and transaction endpoints |
| API8: Security Misconfiguration | Centralized config, disabled ORM auto-sync in runtime path, structured global error filter |
| API10: Unsafe Consumption of APIs / Injection Risks | TypeORM parameterized queries + validated input + no raw unsafe SQL in transaction flow |

## Production Changes
- Use strong secret manager for JWT keys
- Turn on centralized logs + tracing
- Add key rotation + refresh token revocation store if needed
- Enable WAF, TLS termination, and stricter rate limits per IP/user

## Scaling to 1M tx/day
- Horizontal API scaling behind load balancer
- Redis for distributed locking and caching
- MySQL tuning: connection pooling, indexes, partitioning by date/wallet
- Read replicas for query-heavy endpoints
- Asynchronous transfer processing and offloading non-critical audit/analytics to queues

## Tests
```bash
npm test
```
Included tests cover:
1. Concurrent debit simulation (unit) + optional MySQL DB integration concurrency test
2. Idempotency behavior
3. Negative balance prevention
4. Auth guard behavior (reject missing/invalid token, allow valid token)

Run DB integration tests (requires running MySQL configured in `.env`):
```bash
ENABLE_DB_INTEGRATION_TESTS=true npm test -- --runInBand
```
