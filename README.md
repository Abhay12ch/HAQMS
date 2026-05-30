# HAQMS: Security-Hardened & Performance-Optimized Hospital Appointment & Queue Management System

Welcome to the production-ready **HAQMS (Hospital Appointment & Queue Management System)**. This repository was originally a deliberately vulnerable, slow, and unoptimized candidate codebase. It has been thoroughly audited, secured, and performance-optimized across five major engineering dimensions.

This version represents a highly reliable, concurrent, and secure full-stack architecture ready to coordinate patients, medical staff, and queue monitors in real time.

> 🌐 **Live Production Link**: [HAQMS Portal (Vercel)](https://haqms-p7pl8eqzt-abhay-choudharys-projects-a85ba84e.vercel.app/)

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: Next.js (App Router, Tailwind CSS, Lucide icons, Context API)
- **Backend**: Node.js + Express.js API Gateway
- **Database**: PostgreSQL (Supabase Session Pooler integration with pgBouncer compatibilities)
- **ORM**: Prisma ORM (Object-Relational Mapping & Migrations)
- **State & Concurrency Control**: Atomic DB transactions (`Serializable` isolation) & index optimizations

---

## 🚀 Key Improvements & Audited Challenges

### 🔒 1. Production-Grade Security & Compliance Patches
* **Cryptographic Credential Safety**: Removed raw user password logging (`auth.js`), preventing diagnostic log leakage.
* **JWT Expiry Verification & Secret Signatures**: Hardened token signing with custom environment secrets, reduced JWT lifespan from a risky `365d` to a secure `24h` window, and masked internal JWT parser errors (`middleware/auth.js`).
* **SQL Injection (SQLi) Prevention**: Replaced vulnerable raw dynamic queries (`$queryRawUnsafe`) in the physician search with Prisma's auto-parameterized and safe query builder (`doctors.js`).
* **Role-Based Authorization Recovery**: Restored and validated commented-out admin-only endpoint guards (`authorizeAdminOnlyLegacy`) preventing authorization bypasses.
* **Global Error Sanitization**: Configured backend error middlewares to mask detailed database stack traces from production clients to prevent environment enumeration.

### ⚡ 2. High-Concurrency & Backend Performance Optimizations
* **N+1 Database Query Elimination**: Replaced resource-intensive looped sub-queries inside `appointments.js` with integrated database joins using Prisma relations (`include`).
* **Async Event-Loop Concurrency**: Accelerated physician stats retrievals by batching sequential database lookups in a parallelized `Promise.all()` wrapper (`doctors.js`).
* **O(N) Analytical Aggregations Refactored**: Replaced nested loops and artificial `80ms` delays in analytics pipelines (`reports.js`) with native SQL database aggregations (`groupBy` and `count`).
* **Token Race Condition Mitigation**: Wrapped concurrent patient check-ins in a transaction (`$transaction`) with a `Serializable` isolation level (`queue.js`), guaranteeing strict token sequence increments and eliminating duplicate token hazards under peak loads.

### 💾 3. Database Schema & Index Design
* **Double-Booking Prevention Constraint**: Added a strict database-level unique constraint (`@@unique([doctorId, appointmentDate])`) to the `Appointment` model.
* **Multi-Column Query Indexing**: Deployed optimal single and composite indexes:
  - `Doctor`: `[department]`, `[specialization]`
  - `Appointment`: `[doctorId, status]`, `[patientId]`
  - `QueueToken`: `[doctorId, createdAt]`, `[status]`
* **Database-Side Pagination**: Swapped high-memory in-app pagination arrays inside `patients.js` with high-speed, database-level paginated queries (`skip` and `take`).

### 🖥️ 4. React Memory & State Optimization
* **Timer Polling Memory Leak Fix**: Added explicit timer clearups (`clearInterval(intervalId)`) to the Live Public Queue Board on component unmounts to prevent continuous thread bloat.
* **Debounced Search Inputs**: Integrated a `500ms` debounce handler to doctor search fields, eliminating excessive browser re-renders and REST API spam on every keystroke.
* **Anamnesis Null-Pointer Safety**: Protected clinical dashboards from crashing when reading empty medical records by enforcing optional chaining and fallback states.

### 🏗️ 5. Missing Feature Implementation
* **Diagnostic History Portal**: Built and integrated the secure clinical records route `/patients/[id]/history-records` guarded with rigorous, role-based metadata validations to ensure only authorized physicians and administrators can view diagnostic details.

---

## 🔑 Pre-Seeded Accounts

The PostgreSQL seed script populates the database with default accounts (All passwords are **`password123`**):

| Role | Email | Purpose / Flow Testing |
|---|---|---|
| **Administrator** | `admin@haqms.com` | Access system reports, view audit logs, view full physician registries |
| **Receptionist** | `reception1@haqms.com` | Register patients, book slots, perform direct queue check-in |
| **Doctor** | `doctor1@haqms.com` | View daily patient worklist, manage active calling monitors, read history |

---

## ⚙️ Quick Start & Setup

Ensure you have **Node.js (v18+)** and **PostgreSQL** installed.

### 1. Install Workspace Dependencies
Installs dependencies simultaneously in root, frontend, and backend packages:
```bash
chmod +x setup.sh
./setup.sh
```

### 2. Configure Environment variables
Create a `.env` in `backend/`:
```env
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/haqms?schema=public"
JWT_SECRET="your_highly_secure_production_secret_key"
NODE_ENV="production"
```

### 3. Setup Database Schema & Seed Data
Execute Prisma migrations and seed the PostgreSQL database:
```bash
npm run db:setup --prefix backend
```

### 4. Boot the Platform
Launches Next.js (port `3000`) and the API Gateway (port `5000`) concurrently:
```bash
npm run dev
```

---

## 🌐 Production Deployment

The production-ready build is fully optimized and deployed across professional cloud infrastructure:
- **Frontend Web Application**: Deployed and served with low latency via **Vercel** at the live URL: [haqms-p7pl8eqzt-abhay-choudharys-projects-a85ba84e.vercel.app](https://haqms-p7pl8eqzt-abhay-choudharys-projects-a85ba84e.vercel.app/)
- **API Gateway & Backend Services**: Deployed and configured for continuous delivery via **Render**.
- **Production Database**: Hosted on **Supabase** using a managed PostgreSQL cluster.
- **Connection Pooling & Compatibility**: Integrated Supabase's **Session Pooler** (`port 5432` with `?pgbouncer=true` query parameters) in the Render environment configuration. This resolves IPv6 connection limits on IPv4 cloud servers while managing high-throughput connection limits under load.

