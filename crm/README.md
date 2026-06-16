# Enterprise Real Estate CRM Platform Setup Guide

This guide describes how to configure, seed, and run the luxury Real Estate CRM platform.

---

## 🛠️ Step 1: Supabase Database Migration
1. Go to your **Supabase Dashboard** -> Project SQL Editor.
2. Open a new query, copy the contents of the database schema file:
   [supabase/schema.sql](./supabase/schema.sql)
3. Run the SQL script to create tables (`users`, `leads`, `activities`, `followups`, `site_visits`, `notifications`) and RLS policies.

---

## ⚙️ Step 2: Environment Variables
Configure the environment files for both the backend and frontend:

### Backend Configuration
1. Open the backend configuration file:
   [backend/.env](./backend/.env)
2. Fill in the values:
   - `JWT_SECRET`: Get this from your Supabase Dashboard -> Project Settings -> API -> JWT Secret.
   - `SUPABASE_URL`: Your Supabase API endpoint (e.g. `https://xxx.supabase.co`).
   - `SUPABASE_SERVICE_ROLE_KEY`: Get the private `service_role` key from API Settings (DO NOT expose this on the frontend).
   - `DATABASE_URL`: Your Postgres connection string.

### Frontend Configuration
1. Open the frontend configuration file:
   [frontend/.env](./frontend/.env)
2. Set your backend URL:
   - `VITE_API_URL`: `http://localhost:5000` (for local development).

---

## 🚀 Step 3: Seeding & Execution

### 1. Install Dependencies
```bash
# In crm/backend
npm install

# In crm/frontend
npm install
```

### 2. Seed Initial Admin Account
Run the seed script in the backend directory to insert your first Super Admin credentials into the database:
```bash
# In crm/backend
node src/config/seed.js
```
Upon completion, the database will contain:
- **Username**: `admin`
- **Password**: `admin24k`
- **Email**: `admin@24k.com`
- **Role**: `super_admin`

### 3. Start Development Servers
Run the Express backend API and React dev client:
```bash
# In crm/backend
npm run dev

# In crm/frontend
npm run dev
```

The frontend client will start running (typically on `http://localhost:5173`). Open the browser, log in as `admin` / `admin24k` to access the CRM workspaces!
