# TravelMS Local Runtime Inspection

> **Historical report: these findings describe the version before the Waypoint upgrades.** The listed issues were subsequently repaired in the personal edition. See [PROJECT_NOTES.md](PROJECT_NOTES.md), [TEST_REPORT.md](TEST_REPORT.md) and [README.md](README.md) for current functionality, validation and startup instructions. Original line numbers, errors and startup steps below are retained as inspection evidence.

Inspection date: October 6, 2026 (America/Los_Angeles).

## Conclusion at inspection time

One person could run the frontend, backend and MySQL on this Mac. Teammates' computers and a remote server were unnecessary. Signing out and switching between standard and administrator accounts allowed one person to demonstrate both roles.

However, the inspected version could start and perform only part of the advertised workflow. Reproducible defects affected approval buttons, expense categories and report generation. The backend did not enforce authentication or role permissions.

The initial inspection did not change business code, configuration or existing database records. Verification used a temporary project copy and an isolated database. A comparison confirmed that 32 source/configuration files matched the workspace. The isolated database used the same schema as the configured `travelms` database and contained fictional users.

## Environment and observed results

| Item                           | Result at inspection time                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Node.js / npm                  | Installed locally: 26.5.0 / 11.17.0.                                                                                      |
| MySQL                          | Version 9.6.0 was installed and listening on 127.0.0.1:3306.                                                              |
| Configured database            | `.env` selected `travelms`, with users, trips, expenses and reports tables.                                               |
| Existing records               | Before and after inspection: 1 user, 1 trip, 0 expenses and 0 reports.                                                    |
| Dependency installation        | `npm ci` succeeded in the temporary copy, installing 514 packages.                                                        |
| Production frontend build      | `npm run build` passed; initial assets were approximately 319.20 kB, with one nonblocking optional-chaining type warning. |
| Frontend/backend startup       | Both started; the browser opened the application and signed in as administrator and standard user.                        |
| Registration/sign-in           | Registration with a valid password succeeded; correct passwords worked and an incorrect password returned 401.            |
| Trip creation/read             | Valid dates created a trip with status `PLANNED`.                                                                         |
| Administrator approval buttons | New trips did not display Approve / Reject.                                                                               |
| Standard-user editing buttons  | New trips did not display Edit / Delete.                                                                                  |
| Expense recording              | Transport / Other saved; Flight / Hotel / Meals failed.                                                                   |
| Report generation              | Both API and interface failed with a report_status column error.                                                          |
| Automated tests                | `npm test -- --watch=false` failed because no tests were discovered.                                                      |

Some original `node_modules` files had `compressed,dataless` flags, indicating cloud placeholder files; reading them caused noticeable delays. Reinstalling dependencies in a temporary copy allowed fast startup and compilation. Slow startup in the original folder therefore did not prove a source compilation failure. The application could run locally after dependencies were downloaded; an initial installation needed network access.

## Improvements required at inspection time

### 1. Align trip statuses and restore approval

The frontend used `Pending`, `Approved` and `Rejected`. The backend created trips as `PLANNED` and accepted only `PLANNED`, `APPROVED`, `REJECTED` and `COMPLETED` in the status API.

- Approval and standard-user Edit/Delete controls appeared only when `t.status === 'Pending'`, so newly created trips lacked these controls.
- Sending `Approved` as the frontend expected returned 400 / `Invalid status`.
- Sending `Pending` during standard-user editing returned 500 with a status column error.
- An administrator could select `Approved` in the Edit form because the MySQL enum comparison was case-insensitive. That workaround did not repair the dedicated approval buttons or standard-user workflow.

The recommendation was to use consistent API/database constants, such as uppercase statuses, with separate English display labels for pending approval, approved, rejected and completed. Distinct draft/planning and pending-approval states would require explicit transitions and matching schema/API changes.

Original references: [Trip component](TravelMS-main/app/components/trips/trips.component.ts), line 91; [Status API](TravelMS-main/server.js), line 132. These line numbers describe the inspected version, not the current files.

### 2. Align expense categories

The frontend offered Flight / Hotel / Meals / Transport / Other, while the database accepted TRANSPORT / FOOD / LODGING / OTHER.

Flight, Hotel and Meals returned 500 / `Data truncated for column 'category' at row 1`. Transport and Other saved because of the database's enum comparison behavior.

One proposed mapping was Flight/Transport → TRANSPORT, Hotel → LODGING, Meals → FOOD and Other → OTHER, with display labels separate from stored values. If airfare and ground transport required separate reporting, the enum needed to be extended instead of combining them. The later personal edition retained five distinct categories.

Original references: [Expense selector](TravelMS-main/app/components/expenses/expenses.component.ts), line 43; [Category schema](TravelMS-main/fixed_setup.sql), line 39.

### 3. Repair report generation

The backend calculated expense totals and inserted `Generated`; the database accepted only `PENDING`, `SUBMITTED` and `APPROVED`. Generating a report returned 500 / `Data truncated for column 'report_status' at row 1`, even with valid expenses, and the report was not saved.

The initial report status needed to be defined consistently in the backend and schema. Submission/approval required corresponding actions and APIs; at inspection time the application supported only reading, generating and deleting reports. The report screen displayed a list and totals without PDF/CSV export. Export requirements needed to be checked against the course rubric.

Original references: [Report generation API](TravelMS-main/server.js), line 205; [Report status schema](TravelMS-main/fixed_setup.sql), line 58.

### 4. Enforce authentication, roles and ownership on the server

Sign-in checked the password and returned user information, which the frontend stored in localStorage. The backend had no session/token verification or administrator middleware.

In the isolated test database, requests without login credentials could:

- Read user, expense and report lists.
- Create an administrator by supplying `role: 'ADMIN'` to the user creation API.
- Change a trip status to `APPROVED`.
- Attribute one user's trip expense to another user.

Standard-user expense and report pages also requested all trips/users without server-side identity isolation.

The recommendation was to add server sessions or JWT verification, restrict public registration to standard users, check administrator actions on the server and limit standard users to their own trips, expenses and reports. `user_id` and `generated_by` needed to come from a verified identity or be checked against it instead of trusting supplied IDs.

Original references: [User creation API](TravelMS-main/server.js), line 55; [Frontend identity storage](TravelMS-main/app/services/auth.service.ts), line 17.

### 5. Consolidate database setup and administrator creation

| File/configuration                  | Condition at inspection time                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `setup.sql`, `.env.example`, README | Selected database name `travelmanagement`.                                                                         |
| Existing `.env`, `fixed_setup.sql`  | Selected database name `travelms`.                                                                                 |
| `setup.sql`                         | The users table lacked password_hash and created_at required by the backend.                                       |
| `fixed_setup.sql`                   | Included the required fields, but statuses/categories differed from the code and the script began with DROP TABLE. |
| README administrator example        | Omitted password_hash, conflicting with the current table's NOT NULL constraint.                                   |

The recommendation was a single documented setup process, a migration that preserved existing records and bcrypt-based demo administrator creation. Database names, statuses, categories and startup instructions needed to agree.

**The original `fixed_setup.sql` was not safe to rerun against the existing database: it dropped four business tables and their records.** Inspection created tables only in an isolated database; those destructive statements were not run against the business database. The current personal edition uses a preserving setup process.

Original references: [Initial setup script](TravelMS-main/setup.sql), line 7; [Alternative setup script](TravelMS-main/fixed_setup.sql), line 4.

### 6. Complete validation, error handling and tests

- Dates were optional in the interface but required by the database; empty dates returned 500.
- The API accepted end dates before start dates, negative budgets and negative expenses. These needed server-side rejection and clear interface messages.
- Expense attribution could differ from the trip owner; ownership rules needed to be defined and enforced.
- Updating a nonexistent trip ID returned success. Affected rows needed to be checked, with 404 for missing records.
- Duplicate emails, invalid values and missing fields needed clear 400/409 responses instead of exposed database errors.
- Tests were in `app/app.spec.ts`, but sourceRoot and test configuration pointed at `src`, so they were not discovered. An existing assertion expected the old `Hello, Sprint2` template title.

Original references: [Test scope](TravelMS-main/tsconfig.spec.json), line 11; [Old template test](TravelMS-main/app/app.spec.ts), line 17.

## Startup used during the original inspection

These steps describe the earlier version. For the current combined frontend/backend startup, use the root README.

The MySQL service and `travelms` database already existed; recreating the database was unnecessary. After confirming that dependencies were downloaded, the temporary project copy used:

```sh
cd TravelMS-main
npm ci
```

The working `.env` connection was preserved, with database name `travelms`. The database was not changed merely because the original README named `travelmanagement`.

The backend was started in one terminal:

```sh
cd TravelMS-main
npm run server
```

The earlier frontend was started in another terminal:

```sh
cd TravelMS-main
npm start
```

Both terminals remained open while the browser used [Local TravelMS](http://localhost:4200). The API was at `http://localhost:3000/api`. A global Angular CLI and Docker were unnecessary.

Standard users could register through the interface. Administrator records needed valid password hashes; the README's default administrator password could not be assumed to work. Existing account passwords were preserved, and dedicated demo accounts were recommended for the repaired setup.

Startup alone did not repair the functional defects recorded above. Temporary services were stopped, isolated databases were removed and the normal MySQL service continued running after inspection.

## Proposed repair order and acceptance criteria

First align trip statuses, expense categories, report statuses and database scripts so registration → sign-in → trip creation → approval → expense recording → report generation works. Then enforce permissions and validation on the backend, with tests for the workflow and unauthorized access.

Acceptance criteria recorded during inspection:

1. An empty database can be initialized from consistent instructions with standard and administrator accounts.
2. A standard user can submit a trip; an administrator sees the approval controls and saves correct approval/rejection statuses.
3. Every expense category saves and totals are accurate, such as 12.50 + 12.50 = 25.00.
4. Reports are saved successfully and remain available after refresh.
5. Unauthenticated requests cannot read/write business data; standard users cannot approve trips, administer other users or access another user's records.
6. Invalid dates, negative amounts and duplicate emails produce clear errors, with a successful production build and meaningful automated tests.

Receipt upload, PDF/CSV export, search/filtering, pagination, dashboards and email notifications were possible extensions depending on the rubric. The rubric was not provided, so the README alone could not establish whether every course requirement had been met.

## Historical screenshot evidence

At inspection time, the administrator's screen displayed a `PLANNED` trip without approval buttons. Clicking Generate produced the report status error.

The original screenshots are retained locally as `review-evidence/trips.jpg` and `review-evidence/reports.jpg` and are excluded from Git. Current English Waypoint screenshots are included under `review-evidence/`; see the development record and validation report for current evidence.
