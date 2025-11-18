# ROADMAP.md

This file consolidates the actionable roadmap for beLive based on the provided "General Plan" and additional refinements to help the project ship, grow community, and prepare for fundraising.

## Mission
Create an open, web-first platform for musicians to rehearse, perform, and create content: realtime rehearsal loop + vocal tools + visual concert mode. Open-source with premium services for monetization.

## High-level phases (actionable)

### Phase 0 — Stabilize & Ship demo (0–30 days)
- Deliver a stable public demo URL (GitHub Pages or Vercel) showcasing core features.
- Produce 2–3 demo videos (60–120s) and 1 "how-to" video for local run.
- Ensure mobile UX at common breakpoints (360–414px).
- Create 3–5 good-first-issues and label them clearly.

Success criteria:
- Demo URL live and public
- 3 short demo videos published
- ≥3 good-first issues open

Key tasks (issues to open / prioritise):
- mobile-ui: fix viewport tag, tap target sizes, CSS overlaps
- audio-stability: test and fix tempo-change artifacts across Chrome/Firefox/Safari
- demo-scenes: ensure demo scenes load without local heavy setup (host small audio on CDN or Releases)
- create-page: deploy GH Pages + auto-deploy workflow

Branching:
- main (production)
- develop (staging)
- feature/*
- hotfix/*

### Phase 1 — Community & Contributors (1–3 months)
- Launch Discord + GitHub Discussions, prepare CONTRIBUTING + mentor rotation.
- Onboard docs: Quick Start, Dev Environment, Architecture overview, Audio Engine API.
- CI: lint + tests + DCO, enable branch protection.
- Publish 5–10 good-first-issues and hold weekly office hours.

KPIs:
- ≥3 new contributors/month
- Demo visits ≥500/month

### Phase 2 — Productize & Monetize (3–9 months)
- Implement freemium: paid export (stems/HQ), private rooms, priority features.
- Add simple auth (OAuth) and session persistence if needed.
- Analytics for demo usage.
- Start pilot customers and prepare pitch materials.

KPIs:
- MRR > $1k
- Active Users ≥2k MAU

### Phase 3 — Scale & Partnerships (9–18 months)
- Scalable infra for media (CDN + optional backend for recordings).
- AI features (vocal coach, auto-harmonization prototype).
- B2B partnerships and SDK / white-label offers.
- Prepare Series A materials if traction and revenue.

KPIs:
- MRR > $10k
- ≥2 strategic partnerships
- MAU > 10k

## Tactical 30-day checklist (week-by-week)
Day 0–3:
- Finalize README Quick Start, demo links, screenshots.
- Fix mobile viewport + basic CSS issues.
- Create 3 demo shorts and upload to a channel (YouTube/IG/Linked).

Day 4–7:
- Open 5 good-first issues with clear steps and local repro.
- Setup Discord and Discussions; publish onboarding docs.
- Publish short announcement (Reddit, Indie Hackers draft).

Week 2:
- Run first live demo / office hours.
- Start outreach to 10 curated contacts (accelerators + 5 angels).

Week 3–4:
- Implement or mock paid export POC and capture interest/early signups.
- Apply to 2 accelerators (Sound of AI, Techstars Music).

## Repo & ops checklist (immediate)
- README: elevator pitch, quick start, demo link, screenshots (expand now).
- CONTRIBUTING.md & ISSUE templates (already added) — expand onboarding.
- SECURITY.md with contact email and PGP instructions (added).
- .github/workflows: deploy-pages, dco, lint, test (add or refine now).
- CODEOWNERS + branch protection.
- Small demo audio hosted externally (avoid large repo assets).

## Immediate deliverables I will create now (and did)
1) ROADMAP.md (this file) — added to repo.

## Next actions I propose (I can do these for you now):
- Create the top 5 "good first issue" issues (I can open them on the repo).
- Add deploy GH Actions workflow for Pages (deploy-pages.yml).
- Create a short investor one-pager (one-page pitch) and outreach email templates.
- Prepare 3 PR-ready demo issue templates with clear steps and starter-code pointers.