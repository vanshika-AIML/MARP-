# MARP Slide Studio — Frontend Module Architecture

This repository is built as a **modular, integration-ready React application** designed to serve as an embeddable slide authoring module within the larger **MARP Squad** ecosystem or run standalone.

---

## 1. System Topology & Data Flow

```text
+-----------------------------------------------------------------------+
|                           UI View Layer                               |
|   (Dashboard, EditorPage, CodeMirror, SlideNavigator, LivePreview)    |
+-----------------------------------+-----------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                     Hooks & State Machine Layer                       |
|   (usePresentation, useEditor, useWebSocket, PresentationContext)     |
+-------------------+-------------------------------+-------------------+
                    |                               |
       REST CRUD    v                               v  Streaming Events
+-----------------------------------+   +-------------------------------+
|         Service Abstraction       |   |       useWebSocket Hook       |
|  (presentationService, agentSvc)  |   |   (Event lifecycle stream)    |
+-------------------+---------------+   +---------------+---------------+
                    |                                   |
                    v                                   v
+-----------------------------------+   +-------------------------------+
|           api.js Client           |   |      WebSocket Connection     |
|   Base URL: /api/v1 (FastAPI)     |   |    ws://localhost:8000/ws     |
+-----------------------------------+   +-------------------------------+
```

---

## 2. Directory Layout

```text
src/
├── app/                  # Application bootstrap & route container
│   ├── App.jsx           # Root layout supporting standalone & embedded mode
│   ├── routes.jsx        # View identifiers (dashboard, editor, preview)
│   └── Providers.jsx     # Root Context Providers (PresentationContext)
├── pages/                # Top-level Page Views
│   ├── Dashboard.jsx     # Presentation catalog, starter templates & creation
│   ├── EditorPage.jsx    # Primary IDE workspace (CodeMirror + MARP preview)
│   └── PreviewPage.jsx   # Dedicated full-screen presentation stage
├── components/
│   ├── ui/               # Reusable UI Primitives (Design System)
│   │   ├── Button.jsx    # Accessible button variants
│   │   ├── Input.jsx     # Text & search inputs
│   │   ├── Select.jsx    # Custom & native selects
│   │   ├── Badge.jsx     # Status & metadata badges
│   │   ├── Modal.jsx     # Accessible dialogs
│   │   ├── Card.jsx      # Decks & thumbnail card containers
│   │   ├── Tooltip.jsx   # Micro-tooltips for toolbar
│   │   ├── Tabs.jsx      # Navigation tab switcher
│   │   └── Spinner.jsx   # Loading indicators & progress bar
│   ├── layout/           # Framing & layout
│   │   ├── Navbar.jsx    # Header with title editing, view switches, export
│   │   ├── Sidebar.jsx   # Collapsible SlideNavigator container
│   │   ├── Workspace.jsx # Split/Editor/Preview multi-pane layout
│   │   └── StatusBar.jsx # Bottom status bar (word count, slide count, WS status)
│   ├── editor/           # Markdown & CodeMirror components
│   │   ├── CodeMirrorEditor.jsx # CodeMirror 6 markdown editor
│   │   ├── EditorToolbar.jsx    # Formatting + MARP directive shortcuts
│   │   ├── DirectivesHelper.jsx # Dropdown to insert MARP slide directives
│   │   └── MarkdownPreview.jsx  # Live slide viewport & zoom controls
│   └── presentation/     # Slide domain components
│       ├── SlideView.jsx            # Single MARP slide CSS renderer
│       ├── SlideNavigator.jsx       # Left sidebar thumbnail list
│       ├── SlideThumbnail.jsx       # Mini scaled slide card
│       ├── PresentationControls.jsx # Prev/Next slide, zoom & present
│       ├── GenerationOverlay.jsx    # AI slide synthesis modal & stream
│       └── ExportModal.jsx          # HTML, Markdown, PDF, PPTX export
├── services/             # Strict API Abstraction (No UI fetch calls)
│   ├── api.js                   # Base HTTP client with error & timeout handling
│   ├── presentationService.js   # CRUD & render endpoints
│   ├── agentService.js          # AI slide generation endpoints
│   └── mockService.js           # Seamless mock engine for offline testing
├── hooks/                # Reusable React Hooks
│   ├── usePresentation.js       # Centralized presentation store hook
│   ├── useEditor.js             # CodeMirror formatting & slide-sync jumper
│   ├── useWebSocket.js          # Real-time WebSocket lifecycle & events
│   └── useHotkeys.js            # Keyboard shortcuts (Ctrl+S, Ctrl+Enter, Esc)
├── store/                # Centralized Presentation State
│   ├── PresentationContext.jsx  # Reducer, Provider, auto-save debounce
│   └── types.js                 # State shapes & action constants
├── utils/                # Pure Utilities
│   ├── marpParser.js            # Slide splitting (`---`) & directive parser
│   ├── markdownHelpers.js       # Text insertion & formatting
│   ├── exportHelpers.js         # File downloads & printable PDF trigger
│   └── storage.js               # Local storage persistence
└── styles/
    ├── index.css                # Tailwind directives & CodeMirror theme
    └── marp-themes.css          # MARP default, gaia, and uncover styles
```

---

## 3. Centralized Presentation State Model

The core state adheres strictly to the centralized model:

```typescript
interface PresentationState {
  id: string;
  title: string;
  theme: 'default' | 'gaia' | 'uncover';
  markdown: string;
  slides: Array<{
    index: number;
    raw: string;
    content: string;
    directives: Record<string, any>;
    startLine: number;
    endLine: number;
  }>;
  activeSlide: number;
  generationStatus: {
    status: 'idle' | 'connecting' | 'generating' | 'generating_slide' | 'rendering' | 'completed' | 'error';
    progress: number;
    message: string;
    currentSlide: number;
    taskId?: string | null;
  };
  previewStatus: {
    isLive: boolean;
    viewMode: 'split' | 'editor' | 'preview' | 'present';
    isServerRendered: boolean;
    zoom: number;
  };
}
```

---

## 4. Integration Guide (Embedding in Larger MARP Squad System)

### Option A: Mounting the Full Standalone Application

```jsx
import { App } from 'marp-frontend-module';
import 'marp-frontend-module/dist/style.css'; // Or include index.css

function ParentApp() {
  return (
    <div className="w-full h-full">
      <App
        initialRoute="editor"
        initialPresentation={{
          id: 'deck-101',
          title: 'Squad Technical Review',
          theme: 'default',
          markdown: '# My Deck\n---\n## Slide 2',
        }}
      />
    </div>
  );
}
```

### Option B: Embedding the Workspace Component Directly

```jsx
import {
  PresentationProvider,
  Workspace,
  usePresentation,
  useEditor,
} from 'marp-frontend-module';

function CustomPresentationModule() {
  return (
    <PresentationProvider>
      <EmbeddedSlideEditor />
    </PresentationProvider>
  );
}

function EmbeddedSlideEditor() {
  const presentation = usePresentation();
  const editor = useEditor();

  return (
    <Workspace
      slides={presentation.slides}
      activeSlide={presentation.activeSlide}
      onSelectSlide={presentation.setActiveSlide}
      markdown={presentation.markdown}
      onMarkdownChange={presentation.updateMarkdown}
      theme={presentation.theme}
      viewMode="split"
      zoom={1.0}
    />
  );
}
```

### Option C: Reconfiguring API Endpoints via Environment

```env
VITE_API_BASE_URL=https://api.marp-squad.internal/api/v1
VITE_WS_BASE_URL=wss://api.marp-squad.internal
VITE_USE_MOCK_FALLBACK=false
```

---

## 5. WebSocket Event Lifecycle

The `useWebSocket` hook listens on `/ws/generation` and dispatches transitions across the following state protocol:

| Event Type | Payload | Description |
| :--- | :--- | :--- |
| `connecting` | `{}` | Socket connection attempt initiated |
| `connected` | `{}` | Socket established |
| `generating` | `{ progress: 10, message: "Analyzing..." }` | AI model received prompt |
| `generating_slide` | `{ progress: 45, slideIndex: 2 }` | Active slide markdown synthesized |
| `rendering` | `{ progress: 85 }` | MARP layout compiled |
| `completed` | `{ progress: 100, message: "Done" }` | Generation complete |
| `error` | `{ message: "Error detail" }` | Generation failure |
