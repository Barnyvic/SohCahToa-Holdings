# Secure Wallet API (NestJS + MySQL + TypeORM)

## Stack
- NestJS, TypeORM, MySQL, class-validator
- JWT access + refresh tokens
- TypeORM migrations
- Optional Redis distributed lock
- Swagger at `/docs`

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
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /wallet`
- `GET /wallet/:userId` (admin only)
- `GET /transactions?page=1&limit=20`
- `POST /transactions`

## Idempotency Strategy
- `transactions.idempotency_key` is unique
- Request checks existing record first inside DB transaction (`QueryRunner`)
- Duplicate key returns original transaction; no second mutation
- Crash mid-transaction rolls back all state changes
- Refresh tokens are stateless JWTs, so replay window is constrained with short TTL + strong key management.

## Race Condition Prevention
- DB transaction (`QueryRunner`) for write path
- Wallet row locked with pessimistic write (`FOR UPDATE`)
- Optional Redis lock (`wallet-lock:{userId}`) adds cross-node safety
- Two debits against balance `150` for `100` => one success, one failed

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
- Async offload non-critical audit/analytics to queues

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
