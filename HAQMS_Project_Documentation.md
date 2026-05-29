# HAQMS - Technical Documentation & System Audit Report

This document serves as the system audit and technical report for the **HAQMS (Hospital Appointment & Queue Management System)**. It outlines the core vulnerabilities resolved, optimizations performed, and technical reasoning behind key engineering decisions.

---

## 1. Issues Identified & Fixes Implemented

### 1.1. Security & Compliance Remediation

* **Plaintext Credential Logging**: Removed plaintext passwords from registration and login console logs (`auth.js`).
* **JWT Weak Expiry & Leaks**: Enforced JWT expiration verification, shortened duration from `365d` to `24h`, strictly required an env signature secret, and masked internal JWT errors returned to clients (`auth.js` / `middleware/auth.js`).
* **SQL Injection (SQLi)**: Replaced vulnerable raw query interpolation (`$queryRawUnsafe`) in physician search with Prisma's safe, parameterized query builder (`doctors.js`).
* **Admin Authorization Bypass**: Re-enabled and uncommented the admin role verification logic in `authorizeAdminOnlyLegacy` to protect delete endpoints (`middleware/auth.js`).
* **Production Information Disclosure**: Configured the global error handler to suppress detailed database error messages and stack traces to clients in production (`index.js`).

---

### 1.2. Performance & Concurrency Fixes (Optimizations)

* **N+1 Database Queries**: Resolved appointment loops by utilizing Prisma's built-in relation `include` joins to retrieve patients and doctors in a single SQL operation (`appointments.js`).
* **Sequential Event-Loop Stalling**: Wrapped separate, independent metrics counts and calculations in a concurrent `Promise.all()` structure to drastically reduce latency (`doctors.js`).
* **O(N) Analytical Aggregations**: Replaced sequential database lookups inside loops with bulk aggregate database queries (`groupBy` and count), and removed an artificial `80ms` loop delay (`reports.js`).
* **Check-in Token Race Condition**: Handled duplicate queue token generation during concurrent check-ins by wrapping logic in a Prisma `$transaction` with a `Serializable` isolation level and removing a manual `350ms` delay (`queue.js`).

---

## 2. Database & Frontend Refactoring

### 2.1. Schema & Query Enhancements
* **Double-booking Prevention**: Added a composite unique constraint `@@unique([doctorId, appointmentDate])` to the `Appointment` model.
* **Query Indexing**: Deployed key database indexes to accelerate searches:
  - `Doctor`: `[department]`, `[specialization]`
  - `Appointment`: `[doctorId, status]`, `[patientId]`
  - `QueueToken`: `[doctorId, createdAt]`, `[status]`
* **Database-Level Pagination**: Replaced heavy Express-in-memory array slicing with database-level case-insensitive filtering, sorting, and paging (`skip` and `take`) in `patients.js`.

### 2.2. Frontend React Fixes & Dynamic Feature
* **React Memory Leak**: Added a `return () => clearInterval(intervalId);` cleanup statement in `queue/page.js` to clean up active queue refresh polling timers on component unmount.
* **Debounced Search Inputs**: Bound the search bar to a `500ms` debounce timer to prevent continuous page re-renders and excessive API fetch commands on every keystroke.
* **Anamnesis Null-pointer Safety**: Handled patient display crashes when selecting empty clinical histories via optional chaining (`medicalHistory?.toUpperCase() || 'NO HISTORY RECORDED'`).
* **Missing Feature Delivery**: Programmed a secure, dynamic clinical records portal at `/patients/[id]/history-records` guarded with strict Doctor and Admin role validations.

---

## 3. Major Engineering Decisions & Reasoning

* **Database Offloading**: Shifted filtering, pagination, and calculations from Node.js runtime memory to the PostgreSQL engine to lower memory utilization, minimize network payloads, and ensure infinite scalability.
* **Atomic Concurrency Controls**: Selected a `Serializable` isolation level for transaction sequencing to strictly guarantee token consistency during heavy, simultaneous traffic bursts without locking up the database.
* **IPv4 Host Compatibility (Supabase)**: Configured environment variables in Render to connect to Supabase's **Session Pooler** (port `5432`) with `?pgbouncer=true` to resolve IPv6 network limits on IPv4-only cloud hosting instances.

---

## 4. Remaining Known Issues

* **LocalStorage Credentials**: JWT and user details reside inside plaintext `LocalStorage`, exposing them to potential XSS attacks. Production should use HTTP-Only, secure, SameSite cookies.
* **API Payload Inconsistencies**: The REST responses vary in payload structure (some returned flat, others wrapped in `data`). Standardizing REST contracts is recommended.
