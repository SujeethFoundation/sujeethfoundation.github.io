# The Sujeeth Foundation

**We help students network into their first job.**

---

## What We Do

Too many college graduates end up underemployed. We work on that with **Career Circles**—a six-week mentorship program where students practice the skills that actually land jobs.

**The model:**
- A small group of students and one trained mentor
- 1 hour per week for 6 weeks
- Structured curriculum: self-assessment, resume building, networking, interview prep, and follow-up
- Real skills, not motivation speeches

**The numbers:** program counts, outcomes and cost per student change as each cohort finishes. Read the current figures at [sujeeth.org](https://sujeeth.org) and in the [impact reports](https://topics.sujeeth.org/impact). This README does not repeat them.

---

## Why This Works

The magic happens in small group discussion. Students show up with real resumes. They practice real answers. They get real feedback from someone who's been through job search before.

We don't tell students *what* to do. We teach them *how* to figure it out. That's what we mean by exercising agency.

Each week builds on the last:

| Week | Focus |
|------|-------|
| 1 | Self-assessment—what do you actually want? |
| 2 | Research & exploration—where do those jobs exist? |
| 3 | Resume & prep—how do you present yourself? |
| 4 | Networking—who do you need to talk to? |
| 5 | Job applications & interviews—the actual grind |
| 6 | Follow-up & negotiations—what happens next? |

---

## What Students Say

> "I was struggling with how to effectively search for jobs and present myself during interviews. My mentor took the time to walk me through effective job search methods and helped me improve my interviewing skills through mock interviews. His mentorship made a real difference in helping me feel career-ready."

> "I felt overwhelmed by finding a full-time job and was unsure where to start. My mentor helped me learn the importance of networking and gave me feedback on my personal brand. I gained more confidence in my abilities and in navigating the job market."

> "I asked my mentor how to be more noticeable. He told me to reach out to people at the companies I'm interested in and connect with them on LinkedIn. I did it with HubSpot and got an interview. I'm now in the second round!"

---

## Our Partners

We currently work with schools across the country. Our first major partnership is with the **Trulaske School of Business at the University of Missouri**, where we support Career Circles in their Sales and Customer Service program.

If your school wants to run Career Circles, we handle:
- Curriculum and content
- Mentor training
- Student enrollment
- Program coordination

You handle:
- Recruiting mentors from your alumni or local professionals
- Organizing student sign-ups

---

## Who We Are

**Our values:**
- Resilience over perfection
- Transparency over inspiration
- Agency over rescue

We believe that investing in students means investing in a better world. College is expensive. The benefits should be worth it—and they are when students know how to land jobs that matter to them.

---

## Get Involved

**Students:** Apply for Career Circles at your school. Check with your career services or email hello@sujeeth.org.

**Mentors:** Volunteer your time. We provide all the content and support. https://portal.sujeeth.org/volunteer

**Schools:** Partner with us to run Career Circles on your campus. Email hello@sujeeth.org.

**Donors:** See how a gift is used and read our published financials at https://www.sujeeth.org.

---

## About this repository

This repo holds the public website at sujeeth.org (Jekyll on GitHub Pages), the wiki and Discussions, and the front-end code the Power Pages portal and chat widget load from the site.

| Path | What it is |
|---|---|
| `index.html`, `partner.html`, `volunteer.html`, `circle.html`, `chat.html`, ... | Site pages |
| `_posts/`, `_alerts/`, `_feedbacks/`, `impact/`, `report/`, `whitepaper/` | Posts, alerts, student feedback, impact reports and the whitepaper |
| `js/` | Chat widget (`sujeeth-chat-widget.js`, `foundry-chat-connection.js`), course player (`sujeeth-course-player.js`), `theme.js` |
| `css/` | Site styles, plus `css/powerpages/` for the stylesheets the portal uses |
| `architecture/` | How the platform works: repos and Azure services, the Dataverse data model and portal, and the business model |
| `docs/` | Technical notes, for example the course player |

To preview the site locally, install Ruby and run `bundle install` then `bundle exec jekyll serve`.

## Platform architecture

The Sujeeth Foundation helps college students network into their first job through Career Circles, a six-week mentorship program. Students, mentors and partners use two front ends, the static site at sujeeth.org and a Power Pages portal, both on one Dataverse environment. Azure Function apps add chat, knowledge search, payments, short links and texting. The Dataverse side (Base Camp, circles, book requests, surveys, credentials, the Career Ascent course) ships as Dataverse solutions and has no repo.

| Repo (README) | Role |
|---|---|
| [`sujeethfoundation.github.io`](https://github.com/SujeethFoundation/sujeethfoundation.github.io/blob/main/README.md) | Website at sujeeth.org, wiki, Discussions, course player and Power Pages CSS |
| [`chat`](https://github.com/SujeethFoundation/chat/blob/main/README.md) | Chat API behind the site's assistant widget |
| [`mcp`](https://github.com/SujeethFoundation/mcp/blob/main/README.md) | MCP server (the "Sujeeth Foundation Graph") that AI assistants use to search Foundation knowledge |
| [`ontology`](https://github.com/SujeethFoundation/ontology/blob/main/README.md) | Concept graph and governance: concepts, approved domains, Feelings API |
| [`websearch`](https://github.com/SujeethFoundation/websearch/blob/main/README.md) | Crawler and hybrid search over ontology-approved websites |
| [`wikisearch`](https://github.com/SujeethFoundation/wikisearch/blob/main/README.md) | Keyword search over the GitHub wiki |
| [`payments`](https://github.com/SujeethFoundation/payments/blob/main/README.md) | PayPal checkout and webhook for online courses |
| [`shortener`](https://github.com/SujeethFoundation/shortener/blob/main/README.md) | Link shortener for go.sujeeth.org |
| [`acs-sms-bot`](https://github.com/SujeethFoundation/acs-sms-bot/blob/main/readme.md) | Texting through Azure Communication Services |

Architecture docs, in the website repo's `architecture/` folder: [platform architecture](https://github.com/SujeethFoundation/sujeethfoundation.github.io/blob/main/architecture/platform-architecture.md) (repos, Azure apps, how they connect), [data model and portal](https://github.com/SujeethFoundation/sujeethfoundation.github.io/blob/main/architecture/platform-data-model-and-portal.md) (Dataverse tables, solutions, Power Pages) and [business architecture](https://github.com/SujeethFoundation/sujeethfoundation.github.io/blob/main/architecture/business-architecture.md) (vision, assumptions, tests). This block is the same in every repo's README; the canonical copy is in the platform architecture doc.

**This repo:** the website, wiki and front-end code. The Power Pages portal and the chat widget load JavaScript and CSS from here.

---

## Learn More

- **Website:** [sujeeth.org](https://sujeeth.org)
- **Resources:** [topics.sujeeth.org](https://topics.sujeeth.org)
- **Email:** hello@sujeeth.org
- [Wiki](https://github.com/SujeethFoundation/sujeethfoundation.github.io/wiki)
- [Discussions](https://github.com/SujeethFoundation/sujeethfoundation.github.io/discussions)

---

*Unlock the opportunity of education.*
