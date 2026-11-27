# Sujeeth Foundation: Business Architecture

Draft 2026-11-26. Program figures here are Avi's planning numbers, not figures from sujeeth.org. Check them against the site before using them in an external document.

The companion docs are [platform-architecture.md](platform-architecture.md) and [platform-data-model-and-portal.md](platform-data-model-and-portal.md).

## Vision

End underemployment for college graduates.

## How we pursue it today

The Foundation partners with schools to deliver circles. A circle puts a small group of students with a mentor. Mizzou is the main partner. The platform behind it (Base Camp, online circles, the Career Ascent course, credentials) is described in the two companion docs.

## What the Foundation says publicly

From the Foundation Graph (the Foundation's site and wiki), checked 2026-11-26. Program figures are not repeated here. Get current numbers from [sujeeth.org](https://sujeeth.org).

- **Mission.** Solve underemployment for recent college graduates through mentorship and career development, and activate students' agency in their career journey ([Partner page](https://sujeeth.org/partner)).
- **Format.** A six-week program. A mentor facilitates a small group. The Foundation provides the content, mentors facilitate, and students do the work ([Donor FAQ](https://github.com/SujeethFoundation/sujeethfoundation.github.io/wiki/FAQ-for-Donors)). Each session lasts about an hour, runs on Microsoft Teams, and is not graded ([Student FAQ](https://github.com/SujeethFoundation/sujeethfoundation.github.io/wiki/FAQ-for-Students)).
- **Weekly arc.** Self-assessment, research and exploration, resume and preparation, networking, applications and interviews, follow-up and negotiation ([Program Overview](https://github.com/SujeethFoundation/sujeethfoundation.github.io/wiki/Program-Overview%3A)).
- **Books.** Registered students can request free books, and the Foundation moved to an on-demand book model in 2025 ([Books page](https://portal.sujeeth.org/books), Donor FAQ).
- **Where it ran.** A spring 2025 cohort at the University of Missouri, with a published report ([Impact reports](https://topics.sujeeth.org/impact)). The Donor FAQ says no fall 2025 cohort ran, and the plan since then is to restart with trained mentors, a tested cohort and a partner school that is ready, using a Plan, Launch, Learn process.

## Assumptions we operate on

1. **Students treat the job search like an audition.** They prepare, perform and get judged, so practice and feedback help. *In the program:* Week 5 (applications and interviews, including storytelling answers) and Week 6 (follow-up). The Graph returned no page that uses the audition framing, so this assumption may not be stated publicly yet.
2. **Teaching students about agency can produce meaningfully better outcomes.** Students who act on their own search do better than students who wait. *In the program:* the home and partner pages say the program encourages students to exercise agency, and the Program Overview describes students taking ownership of their career journey.
3. **Mentors and career centers have the most lasting impact on students.** A person who knows the student beats any content. *In the program:* mentors are the main volunteer role, substitutes exist so students get consistent sessions, and the impact reports track career center engagement at partner schools.

## Challenges to those assumptions

- **Mizzou is sending fewer students through the program.** The school is questioning the value of mandating it.
- **Net Promoter Score is between 0 and 20.** Students are lukewarm, not enthusiastic.

The Mizzou trend tests the school-partner and mandate model. The NPS range tests whether circles, as delivered, pass assumptions 2 and 3 for students who did not choose to be there.

## Insights

1. The program delivers exceptional value when it catches a student while they are actively looking for a job.
2. Students want a conversation, not just content.
3. It is hard to meet students where they are, on demand.

Read together: timing and conversation drive the value, and a mandated, scheduled cohort supplies neither reliably. That is the case for tests 2 and 3 below.

## Tests

| # | Test | What it tries to prove |
|---|---|---|
| 1 | Mentor training will improve delivery | Delivery quality is the lever behind the NPS range |
| 2 | A B2C model, made of an OpenAI app, a Claude app and online courses, can catch students where they are | The MCP server and apps reach students at the moment they search, without a school mandate |
| 3 | Students can use the online tools and courses to run self-administered circles | Circles can run without a Foundation-staffed mentor |
| 4 | Serving 1 million people costs about $38K a month | The B2C model can fund itself |

What the Graph shows about the tests (searched 2026-11-26):

- **Test 1.** The Foundation's public restart plan already names trained mentors. The Graph returned nothing on mentor training or onboarding, so there is no public baseline to improve on yet.
- **Test 2.** The Graph covers circles, mentors, books, surveys, partners and career guidance. It returned nothing on Career Ascent, the online course or certificates, so an AI assistant connected to the MCP server cannot answer questions about the course today. The B2C path depends on closing that gap.
- **Tests 3 and 4.** Not searched. They concern plans, not published material.

## Cost model for test 4

A 12-month plan. Authenticated users are 10% of MCP users in every month. Costs are Power Pages plus Azure. Each certificate nets $48 after PayPal. All figures are estimates.

| Month | MCP users | Auth users | Power Pages | Azure | Total per month | Break-even certificates per month | Needed as % of auth users |
|---|---|---|---|---|---|---|---|
| 1 | 4K | 420 | $250 | $205 | $455 | 9 | 2.3% |
| 2 | 14K | 1.4K | $750 | $460 | $1,210 | 25 | 1.8% |
| 3 | 39K | 3.9K | $1,875 | $1,065 | $2,940 | 61 | 1.6% |
| 4 | 93K | 9.3K | $1,875 | $2,435 | $4,310 | 90 | 1.0% |
| 5 | 205K | 20.5K | $3,862 | $5,226 | $9,088 | 189 | 0.9% |
| 6 | 390K | 39K | $7,331 | $9,859 | $17,190 | 358 | 0.9% |
| 7 | 614K | 61K | $11,512 | $15,446 | $26,959 | 562 | 0.9% |
| 8 | 799K | 80K | $12,500 | $20,079 | $32,579 | 679 | 0.8% |
| 9 | 911K | 91K | $12,500 | $22,870 | $35,370 | 737 | 0.8% |
| 10 | 966K | 97K | $12,500 | $24,240 | $36,740 | 765 | 0.8% |
| 11 | 990K | 99K | $12,500 | $24,845 | $37,345 | 778 | 0.8% |
| 12 | 1.0M | 100K | $12,500 | $25,100 | $37,600 | 783 | 0.8% |

What the table says:

- Break-even needs roughly 0.8% of signed-in users to buy a certificate each month once volume is steady. It needs 2.3% in month 1 and falls as volume grows.
- Break-even certificates equal total cost divided by $48.
- Power Pages cost stops growing at $12,500 from month 8. Azure keeps climbing and is two-thirds of the cost at 1.0M users.

What the model leaves open:

1. Revenue has one source. Break-even counts certificates only. Course sales, coupons and partner funding are not in it.
2. The conversion rate is untested. 0.8% of signed-in users is the assumption that decides whether the model works. The first months of real data will replace the plan's figure.
3. The signed-in share of 10% is also an assumption. At 5%, the break-even share doubles.

## Related READMEs

- Platform map and repo list: [platform-architecture.md](platform-architecture.md)
- Test 2 (MCP server and apps reach students): [mcp README](https://github.com/SujeethFoundation/mcp/blob/main/README.md), [ontology README](https://github.com/SujeethFoundation/ontology/blob/main/README.md)
- Test 4 (cost model, Azure side): [websearch README](https://github.com/SujeethFoundation/websearch/blob/main/README.md), [payments README](https://github.com/SujeethFoundation/payments/blob/main/README.md)
