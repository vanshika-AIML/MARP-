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

# Real-time WebSocket Base URL
VITE_WS_BASE_URL=ws://localhost:8000

# Standalone development fallback
VITE_USE_MOCK_FALLBACK=true
```

### 3. Run Development Server

```bash
npm run dev
```

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

See [ARCHITECTURE.md](file:///c:/Users/prata/OneDrive/Desktop/MARP%20frontend/ARCHITECTURE.md) for full embedding and integration details.
