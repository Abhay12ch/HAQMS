# HAQMS Codebase Audit & Project Analysis Report

This document contains a comprehensive analysis of the **HAQMS (Hospital Appointment & Queue Management System)** codebase. The audit covers security vulnerabilities, backend performance bottlenecks, database schema optimizations, React performance issues, and incomplete features as outlined in the evaluation challenges.

---

## Table of Contents
1. [Challenge 1: Security Audit](#1-challenge-1-security-audit)
2. [Challenge 2: Backend Performance & Concurrency](#2-challenge-2-backend-performance--concurrency)
3. [Challenge 3: Database & Schema Optimization](#3-challenge-3-database--schema-optimization)
4. [Challenge 4: Frontend Memory & React Optimization](#4-challenge-4-frontend-memory--react-optimization)
5. [Challenge 5: Incomplete Feature Delivery](#5-challenge-5-incomplete-feature-delivery)
6. [Summary of Action Items](#6-summary-of-action-items)

---

## 1. Challenge 1: Security Audit

### 1.1. Credential Logging
* **Vulnerability**: Plaintext passwords and full request payloads containing passwords are logged to the console, exposing sensitive information in application logs.
* **Locations**:
  * [backend/src/routes/auth.js:L14](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/auth.js#L14):
    ```javascript
    console.log('[DEBUG] Registering user with payload:', JSON.stringify(req.body));
    ```
  * [backend/src/routes/auth.js:L57](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/auth.js#L57):
    ```javascript
    console.log(`[AUTH] Login attempt for email: ${req.body.email} with password: ${req.body.password}`);
    ```
* **Remediation**: Remove sensitive variables from logging. Use a logger middleware (like Winston or Bunyan) with password sanitization filters.
  ```javascript
  // Fix for Login:
  console.log(`[AUTH] Login attempt for email: ${req.body.email}`);
  ```

### 1.2. Leaky Token Signature & Verification
* **Vulnerability**:
  * JWT verification explicitly ignores expiration checks (`ignoreExpiration: true`).
  * Tokens are generated with a very long duration (`365d`), increasing the window of exploit if a token is compromised.
  * Secrets fallback to a hardcoded string `my-super-secret-secret-key-12345!!!`.
  * Middleware returns detailed JWT error descriptions directly to clients, which leaks internal cryptographic details.
* **Locations**:
  * [backend/src/routes/auth.js:L8](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/auth.js#L8) & [L76-80](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/auth.js#L76-L80)
  * [backend/src/middleware/auth.js:L3](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/middleware/auth.js#L3), [L17](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/middleware/auth.js#L17), & [L24](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/middleware/auth.js#L24)
* **Remediation**:
  1. Enforce that `JWT_SECRET` must be set in `.env` and throw an error on startup if it is missing.
  2. Reduce token validity to a reasonable timeframe (e.g., `24h` or `1h` with refresh tokens).
  3. Set `ignoreExpiration: false` (or remove the option since it defaults to false) in `jwt.verify`.
  4. Return generic messages (e.g., `"Invalid or expired token."`) to clients, logging details internally.

### 1.3. SQL Injection
* **Vulnerability**: The search queries in the Doctor lookup endpoint use raw string interpolation inside Prisma's `$queryRawUnsafe` instead of parameterized inputs.
* **Location**: [backend/src/routes/doctors.js:L19-34](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/doctors.js#L19-L34):
  ```javascript
  if (search) {
    conditions.push(`name ILIKE '%${search}%'`);
  }
  // ...
  const doctors = await prisma.$queryRawUnsafe(query);
  ```
* **Remediation**: Use Prisma's safe query builder API (`findMany`) instead of raw SQL queries, or sanitize inputs and use parameterized templates via `$queryRaw`.
  ```javascript
  // Safe Prisma query builder:
  const doctors = await prisma.doctor.findMany({
    where: {
      name: search ? { contains: search, mode: 'insensitive' } : undefined,
      specialization: (specialization && specialization !== 'All') ? specialization : undefined,
    }
  });
  ```

### 1.4. Bypassed Authorization
* **Vulnerability**: The admin authentication middleware `authorizeAdminOnlyLegacy` has the role validation check commented out, meaning any logged-in user can invoke admin routes (such as deleting patient records).
* **Locations**:
  * [backend/src/middleware/auth.js:L51-61](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/middleware/auth.js#L51-L61):
    ```javascript
    // if (req.user.role !== 'ADMIN') {
    //   return res.status(403).json({ error: 'Access denied. Admin only.' });
    // }
    ```
  * [backend/src/routes/patients.js:L118](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/patients.js#L118):
    ```javascript
    router.delete('/:id', authenticate, authorizeAdminOnlyLegacy, async (req, res) => { ... })
    ```
* **Remediation**: Uncomment the role check validation to prevent non-admin accounts from executing administrative operations.

---

## 2. Challenge 2: Backend Performance & Concurrency

### 2.1. N+1 Database Queries
* **Bottleneck**: The API loops through every retrieved appointment record and triggers separate database queries to retrieve the associated `Patient` and `Doctor` details.
* **Location**: [backend/src/routes/appointments.js:L29-46](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/appointments.js#L29-L46):
  ```javascript
  for (const app of appointments) {
    const patient = await prisma.patient.findUnique({ where: { id: app.patientId } });
    const doctor = await prisma.doctor.findUnique({ where: { id: app.doctorId } });
    // ...
  }
  ```
* **Remediation**: Utilize Prisma's built-in `include` option to retrieve appointments and their relationships in a single database transaction query.
  ```javascript
  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { appointmentDate: 'asc' },
    include: {
      patient: true,
      doctor: true
    }
  });
  ```

### 2.2. Event-Loop Blocking / Sequential Database Requests
* **Bottleneck**: Independent database aggregations and counts are executed sequentially using `await` calls, stalling progress and increasing endpoint latency.
* **Location**: [backend/src/routes/doctors.js:L51-69](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/doctors.js#L51-L69):
  ```javascript
  const totalDoctors = await prisma.doctor.count();
  const surgeonsCount = await prisma.doctor.count({ where: { department: 'Surgery' } });
  // ...
  ```
* **Remediation**: Run independent promises concurrently using `Promise.all()`.
  ```javascript
  const [totalDoctors, surgeonsCount, averageFee, highestExperience] = await Promise.all([
    prisma.doctor.count(),
    prisma.doctor.count({ where: { department: 'Surgery' } }),
    prisma.doctor.aggregate({ _avg: { consultationFee: true } }),
    prisma.doctor.aggregate({ _max: { experience: true } }),
  ]);
  ```

### 2.3. Slow Aggregation Endpoint
* **Bottleneck**: The nested report generator queries multiple statistics database queries sequentially for each doctor inside a loop, compounded by an artificial sleep.
* **Location**: [backend/src/routes/reports.js:L21-70](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/reports.js#L21-L70).
* **Remediation**:
  1. Remove the artificial sleep `await new Promise(r => setTimeout(r, 80));`.
  2. Use Prisma's `include` with relationship counts (`_count`) or execute a single, performant raw group-by aggregation query to fetch records in bulk.

### 2.4. Check-in Token Race Condition
* **Concurrency Bug**: Multiple concurrent check-ins retrieve the current maximum token via an aggregate read, calculate the next integer, and then create the record. If requests overlap during the artificial 350ms delay, they assign identical token numbers.
* **Location**: [backend/src/routes/queue.js:L49-81](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/queue.js#L49-L81):
  ```javascript
  const maxTokenResult = await prisma.queueToken.aggregate({ ... });
  const currentMax = maxTokenResult._max.tokenNumber || 0;
  const nextTokenNumber = currentMax + 1;
  await new Promise((resolve) => setTimeout(resolve, 350));
  const newToken = await prisma.queueToken.create({ data: { tokenNumber: nextTokenNumber, ... } });
  ```
* **Remediation**:
  1. Add a unique index constraint `@@unique([doctorId, tokenNumber, date])` in the schema (requires storing a separate `date` column or extracting it).
  2. Perform the read-and-update atomically within a database transaction using a raw serializable isolation level or an auto-incrementing queue counter.

---

## 3. Challenge 3: Database & Schema Optimization

### 3.1. Schema Vulnerabilities (Double-booking Slots)
* **Design Defect**: The schema lacks a unique constraint on appointment slots, enabling multiple patients to book the same physician at the exact same millisecond.
* **Location**: [backend/prisma/schema.prisma:L43-60](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/prisma/schema.prisma#L43-L60) (`Doctor` / `Appointment` models).
* **Remediation**: Add a unique constraint in `schema.prisma` under the `Appointment` model:
  ```prisma
  model Appointment {
    // ...
    @@unique([doctorId, appointmentDate])
  }
  ```

### 3.2. Missing Indices
* **Defect**: The database performs full table scans under load because index structures are missing on frequently filtered fields.
* **Locations**: [backend/prisma/schema.prisma](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/prisma/schema.prisma)
  * `Doctor`: Missing index on `department` and `specialization`.
  * `Appointment`: Missing index on `(doctorId, status)` and `patientId`.
  * `QueueToken`: Missing index on `(doctorId, createdAt)` and `status`.
* **Remediation**: Add `@@index` references in the Prisma schema:
  ```prisma
  model Doctor {
    // ...
    @@index([department])
    @@index([specialization])
  }
  ```

### 3.3. Paging Optimization
* **Bottleneck**: The patient registry endpoint fetches *every* patient from the database and runs sorting, filtering, and slice-based pagination entirely in Express memory.
* **Location**: [backend/src/routes/patients.js:L10-62](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/patients.js#L10-L62):
  ```javascript
  const allPatients = await prisma.patient.findMany({ ... });
  // ... filteredPatients.slice(offset, offset + limit);
  ```
* **Remediation**: Restructure the query parameters and apply sorting, filtering, and paging boundaries (`take` and `skip`) directly inside the database query.
  ```javascript
  const patients = await prisma.patient.findMany({
    where,
    skip: offset,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
  ```

---

## 4. Challenge 4: Frontend Memory & React Optimization

### 4.1. Severe Memory Leak
* **Defect**: The active queue polling page defines a `setInterval` inside `useEffect` but has no corresponding component unmount cleanup handler (`clearInterval`). Navigation registers multiple intervals running simultaneously.
* **Location**: [frontend/src/app/queue/page.js:L37-55](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/frontend/src/app/queue/page.js#L37-L55):
  ```javascript
  useEffect(() => {
    fetchQueueData();
    const intervalId = setInterval(() => { ... }, 3000);
    // Missing: return () => clearInterval(intervalId);
  }, []);
  ```
* **Remediation**: Add a cleanup function returning `clearInterval(intervalId)`.

### 4.2. Unnecessary Re-renders
* **Defect**: The patient lookup search field binds its `onChange` event directly to the state query which is listed in a `useEffect` dependency. Typing triggering query updates causes API calls and layout re-renders on *every single keystroke*.
* **Location**: [frontend/src/app/dashboard/page.js:L103](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/frontend/src/app/dashboard/page.js#L103):
  ```javascript
  useEffect(() => {
    fetchPatients();
  }, [patientSearch, patientGender]); // triggers on every keystroke
  ```
* **Remediation**: Implement a debounce mechanism (e.g. using a debounced term state) or run requests on form submissions/lookup button triggers.

### 4.3. NULL Value Application Crash
* **Defect**: When clicking on patients with blank histories, the dashboard crashes because it calls `.toUpperCase()` on a `null` field.
* **Location**: [frontend/src/app/dashboard/page.js:L897](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/frontend/src/app/dashboard/page.js#L897):
  ```javascript
  selectedPatientHistory.medicalHistory.toUpperCase()
  ```
* **Remediation**: Apply optional chaining and supply a fallback value:
  ```javascript
  selectedPatientHistory.medicalHistory?.toUpperCase() || 'NO RECORDED CLINICAL HISTORY'
  ```

---

## 5. Challenge 5: Incomplete Feature Delivery

### 5.1. Resolve Styled 404 Error (History Records Page)
* **Goal**: Build out the missing dynamic clinical page at `src/app/patients/[id]/history-records/page.js` to retrieve and list history details.
* **Path**: `frontend/src/app/patients/[id]/history-records/page.js`
* **Implementation Design**:
  1. Retrieve patient details by pulling the dynamic `id` route parameter.
  2. Implement authorization guards to ensure only validated roles (Doctor/Admin) access diagnostic files.
  3. Fetch details using the `${API_BASE_URL}/patients/${id}` endpoint.
  4. Build a clean, professional medical report UI detailing diagnosis summaries and appointment chronologies, utilizing Lucide icons and Next.js layout patterns.

---

## 6. Summary of Action Items

| Task ID | Component | Description | Target File | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Backend | Remove console logins of cleartext credentials | `auth.js` | 📋 Pending |
| **SEC-02** | Backend | Enforce expiry check and shorten signature duration | `auth.js` / `middleware/auth.js` | 📋 Pending |
| **SEC-03** | Backend | Parametrization / use Prisma query builder to solve SQLi | `doctors.js` | 📋 Pending |
| **SEC-04** | Backend | Fix administrative authorize logic check bypass | `middleware/auth.js` | 📋 Pending |
| **PERF-01**| Backend | Implement `include` relations queries resolving N+1 | `appointments.js` | 📋 Pending |
| **PERF-02**| Backend | Execute aggregations with `Promise.all` | `doctors.js` | 📋 Pending |
| **PERF-03**| Backend | Optimize loop database calls on statistics endpoint | `reports.js` | 📋 Pending |
| **PERF-04**| Backend | Safeguard check-in tokens sequence from race conditions | `queue.js` | 📋 Pending |
| **DB-01**  | Database | Implement `@@unique` physician booking timestamp slot | `schema.prisma` | 📋 Pending |
| **DB-02**  | Database | Create indexes on filtered query criteria | `schema.prisma` | 📋 Pending |
| **DB-03**  | Database | Move paging offset processing from memory to database | `patients.js` | 📋 Pending |
| **FE-01**  | Frontend | Clear polling interval timer instances on page exit | `queue/page.js` | 📋 Pending |
| **FE-02**  | Frontend | Debounce search inputs to control re-renders | `dashboard/page.js` | 📋 Pending |
| **FE-03**  | Frontend | Add optional chaining on patient medical history render | `dashboard/page.js` | 📋 Pending |
| **FE-04**  | Frontend | Implement dynamic `history-records` detail page | `patients/[id]/history-records/page.js`| 📋 Pending |

---

## 7. Approved Implementation Plan

Below is the approved implementation plan that details the exact changes planned for each file.

```markdown
# Fix All HAQMS Bugs + Frontend UI Overhaul

Fix every identified bug across all 5 challenge categories (security, performance, database, frontend React, missing feature) and overhaul the frontend styling for proper contrast, readability, and a polished dark-mode-first design.

## Proposed Changes

### Backend Security Fixes

#### [MODIFY] [auth.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/auth.js)
- **L14**: Remove `console.log` that dumps the full request body (including cleartext password)
- **L57**: Remove `console.log` that logs plaintext password on login
- **L40-44**: Exclude password hash from registration response (`select` specific fields)
- **L49**: Remove database error leak from registration error response
- **L76-79**: Reduce JWT expiry from `365d` → `24h`
- **L98**: Remove `errorStack` from login error response

#### [MODIFY] [auth.js (middleware)](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/middleware/auth.js)
- **L17**: Remove `ignoreExpiration: true` from `jwt.verify`
- **L24**: Remove `details: error.message` from error response (leak)
- **L57-59**: Uncomment the admin role check in `authorizeAdminOnlyLegacy`

#### [MODIFY] [doctors.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/doctors.js)
- **L12-41**: Replace raw SQL `$queryRawUnsafe` with Prisma's safe `findMany` query builder to fix SQL injection

---

### Backend Performance & Concurrency Fixes

#### [MODIFY] [appointments.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/appointments.js)
- **L22-46**: Replace N+1 loop with Prisma `include: { patient: true, doctor: true }`

#### [MODIFY] [doctors.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/doctors.js)
- **L52-68**: Wrap 4 independent `await` calls in `Promise.all()`
- Remove `debugInfo` leak from response

#### [MODIFY] [reports.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/reports.js)
- **L21-70**: Replace sequential per-doctor loop with bulk Prisma queries using `groupBy` and `_count`
- Remove artificial 80ms sleep

#### [MODIFY] [queue.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/queue.js)
- **L49-81**: Fix race condition by wrapping token generation in a Prisma interactive transaction with serializable isolation
- Remove the artificial 350ms sleep

---

### Database Schema Fixes

#### [MODIFY] [schema.prisma](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/prisma/schema.prisma)
- Add `@@unique([doctorId, appointmentDate])` to `Appointment` model
- Add `@@index([department])` and `@@index([specialization])` to `Doctor` model
- Add `@@index([doctorId, status])` and `@@index([patientId])` to `Appointment` model
- Add `@@index([doctorId, createdAt])` and `@@index([status])` to `QueueToken` model

#### [MODIFY] [patients.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/routes/patients.js)
- **L10-62**: Replace in-memory pagination with Prisma `where` + `skip` + `take` for SQL-level paging

---

### Frontend Bug Fixes

#### [MODIFY] [queue/page.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/frontend/src/app/queue/page.js)
- **L37-55**: Add `return () => clearInterval(intervalId)` cleanup to fix memory leak

#### [MODIFY] [dashboard/page.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/frontend/src/app/dashboard/page.js)
- **L98-103**: Add debounce (500ms) on `patientSearch` to avoid re-fetching on every keystroke
- **L897**: Fix null crash: `medicalHistory.toUpperCase()` → `medicalHistory?.toUpperCase() || 'NO RECORDED CLINICAL HISTORY'`

#### [NEW] [history-records/page.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/frontend/src/app/patients/[id]/history-records/page.js)
- Build the missing patient history-records page that fetches patient data + appointments and renders a clinical record view

---

### Frontend UI/Styling Overhaul

#### [MODIFY] [globals.css](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/frontend/src/app/globals.css)
- Force dark theme by default (the current light theme has low-contrast issues)
- Improve glass morphism backgrounds for better readability
- Fix `.text-xxs` utility class (currently undefined in Tailwind v4)
- Add smooth scrollbar styling and selection colors

#### [MODIFY] [layout.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/frontend/src/app/layout.js)
- Add `dark` class to `<html>` element to activate dark mode

---

### Backend Error Handling

#### [MODIFY] [index.js](file:///c:/Users/abhay/OneDrive/Desktop/Work/Welfound/HAQMS/backend/src/index.js)
- **L52-55**: Remove raw stack trace leak from global error handler in production

---

## Verification Plan

### Automated Tests
- Run `npx prisma migrate dev` to verify schema changes apply cleanly
- Start both servers with `npm run dev` and verify no startup errors
- Test login with each seeded account (admin, receptionist, doctor)
- Test patient search with debounce behavior
- Click on Bruce Wayne / Clark Kent in doctor view — should no longer crash
- Navigate to `/patients/{id}/history-records` — should render instead of 404
- Navigate to `/queue` and back — verify no leaked intervals in console

### Manual Verification
- Verify that all text is clearly visible with proper contrast
- Verify that the SQL injection search now uses safe queries
- Verify that non-admin roles get 403 when trying to delete patients
```

## 8. Summary of Applied Changes

All proposed changes from the implementation plan have been fully executed, verified, and successfully deployed to local servers. Below is the list of changes completed:

### 8.1. Security Fixes (Backend)
- **Credential Logging Fixed**: Removed raw password logging in `backend/src/routes/auth.js` (`/register` and `/login` routes).
- **JWT Expiration & Verification Secured**: Changed JWT token signature duration from a loose `365d` to a secure `24h`. Removed `{ ignoreExpiration: true }` in `jwt.verify` in `backend/src/middleware/auth.js` to ensure expired tokens are rejected.
- **Data Leak Prevention**: Removed database error and stack trace dumps in auth routes and middleware. Modified the global error handler in `backend/src/index.js` to only return error stacks in development (`NODE_ENV === 'development'`).
- **SQL Injection Mitigated**: Refactored the physician search query in `backend/src/routes/doctors.js` to use Prisma's safe parameterized query builder `prisma.doctor.findMany` instead of raw string interpolation `$queryRawUnsafe`.
- **Role Verification Re-enabled**: Uncommented the admin role verification in `authorizeAdminOnlyLegacy` within `backend/src/middleware/auth.js` to prevent non-admin staff from executing critical data deletions.

### 8.2. Performance & Concurrency Fixes (Backend)
- **N+1 Database Query Resolved**: Optimized `backend/src/routes/appointments.js` by utilizing Prisma's `include` feature to fetch `patient` and `doctor` details in a single query.
- **Event-Loop Bottleneck Solved**: Wrapped sequential, blocking database count and aggregation queries in `backend/src/routes/doctors.js` (`/stats` endpoint) with `Promise.all()`, executing them concurrently.
- **Slow Reports Generation Fixed**: Replaced the nested loops that queried the database for every single doctor in `backend/src/routes/reports.js` with O(1) bulk aggregation queries (`groupBy` and `_count` on `appointment` and `queueToken` models) and removed the artificial 80ms delay.
- **Check-in Token Race Condition Resolved**: Wrapped token generation in `backend/src/routes/queue.js` inside a Prisma interactive transaction (`prisma.$transaction`) with a `Serializable` isolation level. Removed the artificial 350ms delay.

### 8.3. Database Schema & Query Optimization
- **Unique Constraint Added**: Appended `@@unique([doctorId, appointmentDate])` to the `Appointment` model in `backend/prisma/schema.prisma` to prevent duplicate slot bookings.
- **Database Indexes Deployed**: Added indexes to speed up table scans on:
  - `Doctor`: `[department]` and `[specialization]`
  - `Appointment`: `[doctorId, status]` and `[patientId]`
  - `QueueToken`: `[doctorId, createdAt]` and `[status]`
- **Database-Level Pagination**: Rewrote `backend/src/routes/patients.js` to perform case-insensitive search and page-boundary limits (`skip` and `take`) directly inside the database query rather than sorting and slicing a massive in-memory array.

### 8.4. Frontend Bug Fixes & Features
- **Memory Leak Cleared**: Added a `return () => clearInterval(intervalId);` cleanup statement in `frontend/src/app/queue/page.js` to stop background timers on unmount.
- **Search Debounce Implemented**: Implemented a 500ms debouncing handler on the patient lookup directory in `frontend/src/app/dashboard/page.js` to prevent heavy query loads on every keystroke.
- **Null Reference Crash Handled**: Applied optional chaining (`selectedPatientHistory.medicalHistory?.toUpperCase()`) to prevent clinical history display crashes when selecting a patient with empty anamnesis records.
- **Import Bug Fixed**: Imported `Link` from `next/link` in `frontend/src/app/dashboard/page.js` to fix compilation crashes when rendering the view records button.
- **New Feature Delivered**: Developed the clinical records page at `frontend/src/app/patients/[id]/history-records/page.js` showing patient details, anamnesis background, and a detailed consultation chronology. Includes user authorization checks so only Doctors and Admins can view records.

### 8.5. Visual Style Overhaul
- **Dark-Theme-First Design**: Updated css variables in `frontend/src/app/globals.css` so the application defaults to a sleek dark theme (`#0b0f19` background and `#111827` cards) even if the system light mode is toggled, matching the dark medical dashboard theme.
- **Readability & lighting**: Revamped text colors, border styles, and glassmorphism transparency filters to ensure all layout elements are readable and have excellent visual contrast.
- **Tailwind Utility Fix**: Formulated a custom CSS rule for `.text-xxs` font styling in `globals.css` to fix undefined classes.
- **Custom Enhancements**: Added custom glassmorphism, glowing button borders, custom themed scrollbars, and select highlight rules.


