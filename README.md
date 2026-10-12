# MARP Slide Studio — Modular Frontend Module

A modular, integration-ready React application for authoring and presenting MARP slide decks. Engineered to be embedded into the larger **MARP Squad** application or run standalone.

---

## 🛠 Tech Stack

- **React 18** + **Vite**
- **Tailwind CSS** (Clean, modern developer-tool light theme)
- **CodeMirror 6** (`@uiw/react-codemirror` with Markdown mode)
- **FastAPI REST Client** (`/api/v1` routes with strict service abstraction)
- **WebSocket Client** (`useWebSocket` hook for real-time generation lifecycle)
- **Lucide Icons**

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```env
# Backend API Base URL (FastAPI /api/v1)
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Optional WebSocket origin; omit to derive it from the API origin
VITE_WS_BASE_URL=ws://localhost:8000
```

### 3. Run Development Server

Presentation creation requires the API and PostgreSQL. AI generation and source
processing also require Redis and the worker. Starting Vite alone does not start
these services.

From this repository directory (`MARP-`), with Docker Desktop running and Python
3.12 / uv installed:

```powershell
Copy-Item backend/.env.example backend/.env # First setup only; keep existing keys
uv sync --project backend
npm run dev:all
```

`dev:all` starts local PostgreSQL/Redis, applies migrations, seeds starter templates,
and runs the API, worker, and Vite. Ctrl+C stops the application processes; Docker
keeps the database running. If Windows reserves port 5432, set the database port
in `backend/.env` to `55432`; the launcher maps Docker to the same port.

For a frontend-only server when the backend is already running:

```bash
npm run dev
```

Vite proxies `/api/v1` HTTP and WebSocket requests to `127.0.0.1:8000` by default.
The frontend environment file is optional for local development. NVIDIA credentials
go only in `backend/.env`; enable `createWithAI` and `aiAgent` in administration
after configuring the provider. Markdown/template creation needs no AI key.

Visit [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production

```bash
npm run build
```

---

## 📂 Architecture

```text
src/
├── app/              # Application bootstrap & route container
├── pages/            # Dashboard, EditorPage, PreviewPage
├── components/
│   ├── ui/           # Reusable UI primitives (Button, Input, Badge, Modal, etc.)
│   ├── layout/       # Navbar, Sidebar, Workspace, StatusBar
│   ├── editor/       # CodeMirrorEditor, EditorToolbar, MarkdownPreview
│   └── presentation/ # SlideView, SlideNavigator, PresentationControls, ExportModal
├── services/         # Strict API abstraction (api.js, presentationService, agentService)
├── hooks/            # usePresentation, useEditor, useWebSocket, useHotkeys
├── store/            # Presentation centralized state & reducer
├── utils/            # MARP parser, markdown helpers, export helpers, storage
└── styles/           # Tailwind CSS, index.css, marp-themes.css
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + S` | Save Presentation |
| `Ctrl + Enter` | Start Fullscreen Presentation Mode |
| `←` / `→` or `Space` | Navigate Previous / Next Slide |
| `Esc` | Exit Fullscreen Mode / Close Modals |

---

## 📖 Module Export API

See [ARCHITECTURE.md](ARCHITECTURE.md) for module details and [PRODUCTION.md](PRODUCTION.md) for local development, deployment, migrations, backup, and recovery.
