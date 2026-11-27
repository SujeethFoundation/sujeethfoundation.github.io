# Sujeeth Foundation: Dataverse Data Model, Solutions and Power Pages Portal

Last verified: 2026-11-26. Table and column names are logical names. Option values are the stored integers. Items marked "inferred" come from names and install dates, not from reading solution components.

The companion doc is [platform-architecture.md](platform-architecture.md).

## Environments

- Prod: the Foundation's Dataverse environment.
- Dev: "Portal Dev", a sandbox with its own Power Pages site.
- Website record: "Program Portal".
- The Backend App User security role covers all backend apps (payments, shortner, chat).

## Foundation Graph concepts and the tables behind them

The Foundation Graph's ontology (version `1.15.5-proposed`, checked 2026-11-26) names concepts that line up with Dataverse tables. The pairing is by name and is not enforced anywhere.

| Graph concept | Dataverse table or field |
|---|---|
| `circle` | `suj_circle` |
| `partnership`, `partner` | `mshied_scholarship` (the Partnership table) and `account` (schools) |
| `career_mentor` | `contact` where `suj_ismentor` is true |
| `substitute_request` | `suj_substitute` |
| `book`, `book_request` | `suj_book`, `suj_bookrequest` |
| `onboarding_survey` | `suj_studentonboarding` |
| `feedback_survey` | `suj_feedback` |
| `impact_report`, `program_statistics` | No table. Numbers come from sujeeth.org |

No Graph concept exists yet for the online course, certificates or coupons. See the coverage note in `platform-architecture.md`.

Public portal pages the wiki links to: `portal.sujeeth.org/books` (free book request) and `portal.sujeeth.org/circle/coverage` (mentor coverage request). `portal.sujeeth.org` is the production portal host, and an approved domain for the Foundation's search.

## Program shape the tables serve

A circle runs six weekly sessions of about an hour: self-assessment, research and exploration, resume and preparation, networking, applications and interviews, follow-up and negotiation. A mentor facilitates a small group.

## Base Camp

Base Camp is part of the Power Pages site, and the site ships in the Core solution. It is the student entry point and exposes online circles and online courses. Online courses run on the Career Ascent course (`/Ascent`, course player, PayPal checkout). Online circles use the circle tables and pages.

Its three portal pages (built 2026-11-22):

| Page | URL | What it is |
|---|---|---|
| Start | `/Start` | The onboarding survey (`suj_studentonboarding`, form "Web Onboarding Form") |
| Camp | `/Camp` | Base Camp itself, the hub where students reach online circles and courses |
| End | `/End` | The feedback survey (`suj_feedback`, form "Web Feedback Form") |

A student goes Start, Camp, End. The custom web template "Sujeeth Onboarding Config" supports this flow.

## Solutions (how the features ship)

The Foundation's program features are Dataverse solutions that Avi built and published to prod, not separate repos. There is no code repo for them. The solution is the source of truth, so changes go dev to prod by solution export and import. All seven Foundation solutions in prod are managed.

| Solution (unique name) | Version | Installed in prod | Contents |
|---|---|---|---|
| Core (`ProgramPortal`) | 3.0.0.2 | 2025-02-02 | The Power Pages site, including Base Camp (Start, Camp, End), plus base tables: contact, partnership, academic period |
| Circles (`Circles`) | 1.2.0.4 | 2026-11-17 | Circles, circle notes, substitutes, volunteers, and the two surveys: onboarding (`suj_studentonboarding`) and feedback (`suj_feedback`) |
| Books (`Books`) | 1.0.0.2 | 2026-11-17 | Books and book requests (inferred) |
| Online Course (`suj_online_course`) | 1.1.0.0 | 2026-11-17 | Course, section, activity, progress, enrollment, coupon (inferred) |
| Certificate (`Certificate`) | 1.1.0.0 | 2026-11-25 | Certificate and certificate award (inferred) |
| App (`suj_App`) | 1.1.0.0 | 2026-11-24 | The Power App for administering all the services the Foundation provides |
| Custom Connectors (`CustomConnectors`) | 1.0.0.2 | 2025-04-19 | Custom connectors, for example the shortener connector (inferred) |

Two unmanaged solutions sit beside them: Alerts and Environment.

## Feature to table map

| Feature | Tables | Portal pieces |
|---|---|---|
| Career circles | `suj_circle`, `suj_circlenotes`, `suj_circleoption`, `suj_substitute`, `suj_volunteer`, `mshied_scholarship` (Partnership), `mshied_academicperiod`, `contact` | Pages: Circle Hub (`/circle`), Circle Detail, Partnership Detail, Volunteer, Coverage. Forms: Circle Details, Circle Notes, Substitute Request, Accept Substitute Request, Career Circle Substitute Requests Web, Web Application (volunteer). Lists: Active Circles, Circle Notes Web View, Open Substitutes Web List, Web Applications, Active Partnership, Admin Partnership Web View |
| Substitute request alerts | `suj_substitute` | A Quick Task in the admin app texts mentors through the `acs-sms-bot` repo |
| Base Camp (Core solution) | Circle and online course tables | Pages Start, Camp, End. Web template "Sujeeth Onboarding Config" |
| Onboarding survey (Circles solution) | `suj_studentonboarding` | Page Start. Form: Web Onboarding Form |
| Feedback survey (Circles solution) | `suj_feedback` | Page End. Forms: Web Feedback Form, Web Feedback Form - Certificate |
| Book requests | `suj_book`, `suj_bookrequest` | Page: Books. Form: Welcome Gift Form. Lists: Active Books, Book Requests Pending, Book Requests Shipped |
| Online courses | `suj_onlinecourse`, `suj_onlinecoursesection`, `suj_onlinecourseactivity`, `suj_onlinecourseactivityprogress`, `suj_onlinecourseenrollment`, `suj_paymentcoupon` | Page: Ascent (`/Ascent`). Course player JS |
| Credentials | `suj_certificate`, `suj_certificateaward` | Pages: My Certificates, Certificate Details. Form: Web Certificate. List: Web Active Certificate Awards |
| Contact us | `suj_portalfeedback` | Form: authenticated contact us form |
| Profile | `contact` | Forms: Contact (Profile Web Form Enhanced), Contact Web Details, Web Form Address, Substitute Web |
| Search indexing | none | Quick Task in the admin app submits site URLs through IndexNow |
| Administration | All of the above | Model-driven app "TSF Back End" (see Admin app) |

Each portal page exists twice in the page table: one row with no language and one with the English language id. That is normal Power Pages content-language structure, not duplication.

## Core tables

**suj_circle**: circle name, day, start, join link, scholarship lookup (Partnership), and start and end skill scores for career, resume, networking, cold call, storytelling, job score and NPS.

**suj_bookrequest**: book lookup, contact, scholarship, tracking number, processed date, current flag. Status: Submitted 924720000, Shipped 924720001, Cancelled 924720002.

**suj_studentonboarding**: career, scores, goal, concerns, superpower, LinkedIn, graduation date, circle, partnership, preference, submitter.

**suj_feedback**: NPS, scores, mentor, suggestions, session rank, circle, partnership, submitter.

**contact**: carries `suj_ismentor` and `suj_circle`.

## Online course tables

- `suj_onlinecourse`: name, description, price, `suj_completion_valid_days`, `suj_end_survey_threshold_percent`.
- `suj_onlinecoursesection`: order, description, video URL, `suj_subscription_access`, course, prerequisite activity.
- `suj_onlinecourseactivity`: order, content, external URL, prerequisite activity, section.
- `suj_onlinecourseactivityprogress`: enrollment, activity, completed on, score percent, completed by.
- `suj_onlinecourseenrollment`: learner, course, partnership, PayPal order and capture IDs, completed on. Access status: Active 100000000, Refunded 100000001, Revoked 100000002.
- `suj_paymentcoupon`: code, discount amount (`tsj_discountamount`, note the `tsj_` prefix), maximum uses, times used.

The player supports subscription access on sections, completion expiry through `suj_completion_valid_days`, and mark incomplete or renew.

## Credential tables

- `suj_certificate`: name, description, course, partnership, `suj_require_student_feedback`, `suj_logo_url`, valid days.
- `suj_certificateaward`: certificate, contact, partnership, student feedback lookup, issued on, expires on. Status: Available 100000000, Issued 100000001, Revoked 100000002.

## Power Pages Web API (site settings)

Enabled and field-restricted for: `suj_onlinecourse`, `suj_onlinecoursesection`, `suj_onlinecourseactivity`, `suj_onlinecourseactivityprogress`, `suj_onlinecourseenrollment`, `suj_certificate`, `suj_certificateaward`, and `contact` (fields `contactid,fullname` only). Each table has `Webapi/<table>/enabled` = true and `Webapi/<table>/fields`. The course player reads these directly, so adding a column the player needs means adding it to that `fields` list too.

Other settings: `OnlineCourse/CareerAscentID` (the Career Ascent course record id) and `OnlineCourse/PaymentsUrl` = `https://payments.sujeeth.org/api`.

## Portal structure

- Web roles: Administrators, Anonymous Users, Authenticated Users, Mentors.
- Web pages (distinct): Access Denied, Ascent, Books, Camp, Certificate Details, Circle Detail, Circle Hub, Contact us, Coverage, Default Offline Page, End, Home, My Certificates, Page Not Found, Partnership Detail, Profile, Search, Start, Volunteer.
- Custom web template: "Sujeeth Onboarding Config". The rest are stock Power Pages templates.
- Content snippet "Chat Widget Code" loads the chat widget on the portal.
- Web files: 28, all published. Stylesheets `bootstrap.min.css`, `portalbasictheme.css`, `theme.css`, `thumbnail.css` (2023 starter) and the Foundation's own `sujeeth-foundation-form.css`, `sujeeth-foundation-power-pages-grid.css`, `sujeeth-foundation-power-pages-modal.css` (2026-11-22). The matching repo copies live in `css/powerpages/` in the site repo. The rest are logos, the PWA manifest, `robots.txt` and images.

## Admin app (TSF Back End)

The administration app is the model-driven app "TSF Back End" (`suj_TSFBackEnd`) in the `suj_App` solution. It covers about 26 tables, 50 forms and 70 views. Navigation has one area and seven groups:

| Group | Screens (tables) |
|---|---|
| My Work | Activities (`activitypointer`), Contacts (`contact`), Portal Feedback (`suj_portalfeedback`), Substitutes (`suj_substitute`), Volunteers (`suj_volunteer`) |
| Partnerships | Scholarships (`mshied_scholarship`, the Partnership table), Circles (`suj_circle`), Recurring Appointments (`recurringappointmentmaster`), Circle Notes (`suj_circlenotes`), Student Onboarding (`suj_studentonboarding`), Feedback (`suj_feedback`) |
| Book Requests | Books (`suj_book`), Book Requests (`suj_bookrequest`) |
| Online Course | Online Course (`suj_onlinecourse`), Online Course Section (`suj_onlinecoursesection`), Online Course Activity (`suj_onlinecourseactivity`), Online Course Enrollment (`suj_onlinecourseenrollment`), Online Course Activity Progress (`suj_onlinecourseactivityprogress`), Payment Coupons (`suj_paymentcoupon`) |
| Certificates | Certificates (`suj_certificate`), Certificate Awards (`suj_certificateaward`) |
| Reporting | Accounts (`account`), Programs (`mshied_program`), Academic Periods (`mshied_academicperiod`) |
| Admin | Users (`systemuser`), Email Templates (`template`), Quick Tasks, Import Files (`importfile`) |

Quick Tasks run two jobs: IndexNow, which submits site URLs to search engines after content changes, and a text to mentors when a substitute request comes in (through the `acs-sms-bot` repo). A canvas app, QuickTasks, also exists in the environment.
