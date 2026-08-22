/**
 * Default Presentation Templates and Mock Data
 */

export const STARTER_TEMPLATES = [
  {
    id: 'deck-tech-arch',
    title: 'Distributed System Architecture',
    description: 'A technical architecture slide deck covering microservices, caching, and scalability.',
    theme: 'default',
    markdown: `---
marp: true
theme: default
paginate: true
header: "Cloud Platform Team"
footer: "Architecture Review 2026"
---

<!-- _class: lead -->
# Modern Cloud Architecture
### Scalable, Resilient & Event-Driven Systems

**Presented by: Platform Engineering**

---

## 🎯 Executive Overview

- **Scalability**: Decoupled event streams using Kafka
- **Resilience**: Multi-region active-active deployment
- **Developer Velocity**: Automated CI/CD & preview environments
- **Security**: Zero-Trust IAM with mTLS across all service meshes

---

## 📐 High-Level Topology

\`\`\`
[ Client App ] ---> [ API Gateway / Traefik ]
                           |
          +----------------+----------------+
          |                                 |
    [ Auth Service ]               [ Slide Generator ]
          |                                 |
    [ PostgreSQL ]                  [ Redis Queue ]
                                            |
                                    [ Worker Nodes (MARP) ]
\`\`\`

---

<!-- _backgroundColor: #0f172a -->
<!-- _color: #f8fafc -->
## ⚡ Performance Targets

| Metric | Current | Target (Q4) | Status |
| :--- | :--- | :--- | :--- |
| **API Latency (p95)** | 145ms | < 80ms | 🟢 On Track |
| **Slide Render Time** | 1.8s | < 0.5s | 🟡 In Progress |
| **Queue Throughput** | 2.5k req/s | 10k req/s | 🟢 Ready |

---

## 🚀 Key Takeaways & Next Steps

1. Transition REST render queue to WebSocket streaming
2. Enable client-side Marpit caching for instant thumbnail previews
3. Integrate AI slide generation agent via FastMCP protocol

> *"Simplicity is a prerequisite for reliability."* — Edsger W. Dijkstra
`,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'deck-pitch',
    title: 'AI Presentation Agent Pitch Deck',
    description: 'Investor & customer pitch deck for automated slide generation from markdown prompts.',
    theme: 'gaia',
    markdown: `---
marp: true
theme: gaia
paginate: true
footer: "MARP Squad 2026 • Confidential"
---

<!-- _class: lead -->
# MARP Squad 🚀
## Next-Gen Automated Slide Intelligence

*Turn ideas and code into production-grade slide decks in seconds.*

---

## The Problem

- 🕒 Engineers and PMs waste **10+ hours a week** aligning slide formatting
- 🤹 Tool fragmentation between Markdown docs and PowerPoint / Google Slides
- 📉 Inconsistent branding, broken diagrams, and out-of-date technical decks

---

<!-- _class: lead -->
## The Solution: MARP Squad

**Single Source of Truth** in Markdown + **Real-Time AI Agents**

---

## Why Developers Love It

- **Markdown First**: Version control presentations with Git
- **Live WebSocket Streaming**: Watch AI build decks in real-time
- **CodeMirror Integration**: Syntax highlighting for 50+ programming languages
- **Instant Multi-Format Export**: HTML, PDF, PPTX, and PNG

---

## 📊 Market Opportunity

- **Target Audience**: 30M+ Developers, Solution Architects & DevRels
- **FastAPI + React Ecosystem**: Modular micro-frontend architecture
- **Ready for Enterprise**: Self-hostable, zero external telemetry
`,
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'deck-uncover',
    title: 'Minimalist Keynote Concept',
    description: 'A bold, punchy presentation designed with the uncover theme.',
    theme: 'uncover',
    markdown: `---
marp: true
theme: uncover
paginate: true
---

# Focus.
### The Art of High-Impact Decks

---

# Less is More.
Cut the clutter. Amplify the message.

---

<!-- _backgroundColor: #0284c7 -->
<!-- _color: #ffffff -->
# Real-Time
Slide generation at the speed of thought.

---

# Thank You
Questions & Live Discussion
`,
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const BLANK_DECK_MARKDOWN = `---
marp: true
theme: default
paginate: true
header: "MARP Studio"
footer: "Presentation"
---

<!-- _class: lead -->
# Untitled Presentation
### Subtitle or Tagline

---

## Slide 2 Title

- Key point 1
- Key point 2
- Key point 3
`;
