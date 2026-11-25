# Chat Backend (NestJS + Strict TypeScript + PostgreSQL + Firebase Firestore)

A production-structured chat backend separating **relational metadata** (PostgreSQL via raw parameterized SQL with `pg`) from **high-throughput messaging & read state** (Firebase Firestore).

---

## Architecture Overview

```
Client ──▶ NestJS REST API (ValidationPipe + Global Exception Filter + Swagger)
             ├──▶ PostgreSQL (pg.Pool + SQL Migrations)
             │      ├── users
             │      ├── chats (with unique direct_pair_key for 1:1 idempotency)
             │      └── chat_members (with role: admin | member)
             └──▶ Firebase Firestore (firebase-admin)
                    └── chats/{chatId}/
                          ├── messages/{messageId}  (text, senderId, timestamp, readBy, isEdited, isDeleted)
                          └── lastSeen/{userId}     (messageId, updatedAt)
```

### Why Hybrid Storage?
- **PostgreSQL (`pg` raw SQL):** Strong relational integrity (`FOREIGN KEY`, `UNIQUE` constraints, transactional `ON CONFLICT DO NOTHING` for race-condition-safe `1:1` chat creation, role-based group management, indexed membership lookups).
- **Firebase Firestore:** Flexible, low-latency message storage, chronological queries (`orderBy('timestamp')`), atomic per-user `readBy` updates via transactions & `FieldPath`, soft-delete / edit tracking, and per-user `lastSeen` pointers.

---

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in your **Supabase PostgreSQL** connection string and **Firebase** credentials:
```bash
cp .env.example .env
```

#### Supabase PostgreSQL
1. In your Supabase project dashboard, go to **Connect** / **Settings -> Database -> Connection string (URI)**.
2. Set `DATABASE_URL` in `.env` and `DATABASE_SSL=true`.

#### Firebase Firestore
1. In Firebase Console, create a **Firestore Database**.
2. Go to **Project Settings -> Service Accounts -> Generate new private key**.
3. Either save the file and set `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json`, OR copy `project_id`, `client_email`, and `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` in `.env`.

### 3. Run Database Migrations & Seed Sample Users
```bash
npm run db:migrate
npm run db:seed
```
The seed script inserts 3 sample users:
- `11111111-1111-4111-8111-111111111111` (Alice)
- `22222222-2222-4222-8222-222222222222` (Bob)
- `33333333-3333-4333-8333-333333333333` (Charlie)

### 4. Start the Server
```bash
npm run start:dev
```
- API Base URL: `http://localhost:3000`
- Swagger Docs: `http://localhost:3000/docs`
- Health Check: `GET http://localhost:3000/health`

---

## API Endpoints

### Core Endpoints
| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/chat/create` | Create or get an existing 1:1 chat (`{ userAId, userBId }`) |
| `POST` | `/chat/:chatId/message/send` | Send a message stored in Firestore (`{ senderId, text }`) |
| `GET` | `/chat/:chatId/messages?limit=50` | Fetch messages ordered chronologically by timestamp |
| `POST` | `/chat/:chatId/message/:messageId/read` | Record read receipt in Firestore (`{ userId }`) |
| `POST` | `/chat/:chatId/lastseen` | Update per-user last seen message in Firestore (`{ userId, messageId }`) |
| `GET` | `/user/:userId/chats` | List user's chats with member IDs from PostgreSQL |

### Bonus Features (Group Chats + Message Edit/Delete)
| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/chat/group` | Create a group chat (`{ name, creatorId, memberIds }`) |
| `GET` | `/chat/:chatId` | Get chat details and member roles |
| `PATCH` | `/chat/:chatId/group` | Rename a group chat (`{ actorId, name }`, admin only) |
| `POST` | `/chat/:chatId/members` | Add members to a group (`{ actorId, userIds }`, admin only) |
| `DELETE` | `/chat/:chatId/members/:userId` | Remove member (admin) or leave group (`{ actorId }`) |
| `PATCH` | `/chat/:chatId/message/:messageId` | Edit a message in Firestore (`{ senderId, text }`, sender only) |
| `DELETE` | `/chat/:chatId/message/:messageId` | Soft-delete a message in Firestore (`{ senderId }`, sender only) |

### Utility Endpoints
| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/users` | Create a user in PostgreSQL (`{ name, email }`, UUID auto-generated) |
| `GET` | `/users` | List all users |
| `GET` | `/users/:userId` | Get a user by ID |
| `GET` | `/health` | Check PostgreSQL & Firestore connectivity |

---

## Verification Commands
```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```
