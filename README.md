# AI Productivity Metrics Dashboard

Dashboard so sanh nang suat team truoc va sau khi ap dung AI, su dung du lieu tu GitHub PRs va Jira Sprints.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Express.js (proxy + caching API)
- **Database:** PostgreSQL 17 (cache data)
- **Deployment:** Docker Compose

## Cau truc project

```
server.js                 # Express server (proxy + caching endpoints + SSE sync)
db.js                     # PostgreSQL connection pool + helpers
src/
  App.jsx                 # Main app (cached loading + Sync button + toast notifications)
  services/github.js      # GitHub API client + stats calculations
  services/jira.js        # Jira API client + sprint calculations
  components/             # MetricCard, PRChart, SprintChart, TimelineChart, SummarySection
docker-compose.db.yml     # PostgreSQL only (deploy 1 lan)
docker-compose.yml        # App only (deploy moi lan update)
```

## Setup & Chay local

### 1. Config environment

Copy `.env.example` thanh `.env` va dien cac gia tri:

```bash
cp .env.example .env
```

Cac bien can thiet:
- `VITE_GITHUB_TOKEN` — GitHub Personal Access Token
- `VITE_JIRA_BASE_URL` — Jira server URL
- `VITE_JIRA_EMAIL` — Jira email
- `VITE_JIRA_API_TOKEN` — Jira API token
- `VITE_JIRA_PROJECT_KEY` — Jira project key (default: AAP)
- `DATABASE_URL` — PostgreSQL connection string
- `VITE_JOIN_DATE` — Ngay chia moc truoc/sau (format: YYYY-MM-DD)

### 2. Start PostgreSQL

```bash
docker compose -f docker-compose.db.yml up -d
```

### 3. Chay dev

```bash
npm install
npm run dev
```

Frontend chay tai `http://localhost:5173`, server tai `http://localhost:3004`.

## Deployment (Production Server)

### Lan dau tien — Setup PostgreSQL (CHI CHAY 1 LAN)

```bash
docker compose -f docker-compose.db.yml up -d
```

> File `docker-compose.db.yml` chi chua PostgreSQL. Data luu trong Docker volume `pgdata`, se khong bi mat khi restart/update app.

### Deploy app

```bash
docker compose up -d --build
```

### Cap nhat app (moi lan co code moi)

```bash
git pull
docker compose up -d --build
```

> **Luu y:** Lenh nay CHI rebuild app container. PostgreSQL KHONG bi anh huong, data KHONG bi mat.

### Kiem tra trang thai

```bash
# Xem containers dang chay
docker ps

# Xem logs app
docker compose logs -f app

# Xem logs database
docker compose -f docker-compose.db.yml logs -f postgres
```

## Data Caching & Sync

- Du lieu tu GitHub va Jira duoc cache trong PostgreSQL (bang `cached_data`)
- Khi load trang, app doc tu cache (nhanh), khong goi API truc tiep
- Neu chua co cache (lan dau), server tu dong fetch va luu
- **Sync Now button:** Nhan de re-fetch du lieu moi nhat tu GitHub + Jira, co hien thi progress realtime
- **Auto sync:** Server tu dong sync moi 24h

## API Endpoints

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| GET | `/api/data/cached` | Tra cached data (auto-sync neu chua co) |
| POST | `/api/data/sync` | Manual sync trigger |
| GET | `/api/data/sync/stream` | SSE sync voi progress realtime |
| GET | `/api/data/status` | Tra sync metadata (lastSyncAt, status) |
| GET | `/api/health` | Health check |
| GET | `/api/github/*` | GitHub API proxy |
| GET | `/api/jira/*` | Jira API proxy |
