/**
 * MARP Presentation Module - Public Exports
 * Allows the larger MARP Squad system to import and embed this module.
 */

// App & Core Providers
export { App, default } from './app/App';
export { Providers } from './app/Providers';
export { APP_ROUTES } from './app/routes';

// Pages
export { Dashboard } from './pages/Dashboard';
export { EditorPage } from './pages/EditorPage';
export { PreviewPage } from './pages/PreviewPage';

// Presentation Components
export { SlideView } from './components/presentation/SlideView';
export { SlideNavigator } from './components/presentation/SlideNavigator';
export { SlideThumbnail } from './components/presentation/SlideThumbnail';
export { PresentationControls } from './components/presentation/PresentationControls';
export { GenerationOverlay } from './components/presentation/GenerationOverlay';
export { ExportModal } from './components/presentation/ExportModal';

// Editor Components
export { CodeMirrorEditor } from './components/editor/CodeMirrorEditor';
export { EditorToolbar } from './components/editor/EditorToolbar';
export { DirectivesHelper } from './components/editor/DirectivesHelper';
export { MarkdownPreview } from './components/editor/MarkdownPreview';

// UI Primitives
export { Button } from './components/ui/Button';
export { Input } from './components/ui/Input';
export { Select } from './components/ui/Select';
export { Badge } from './components/ui/Badge';
export { Modal } from './components/ui/Modal';
export { Card } from './components/ui/Card';
export { Tooltip } from './components/ui/Tooltip';
export { Tabs } from './components/ui/Tabs';
export { Spinner, ProgressBar } from './components/ui/Spinner';

// Services
export { api } from './services/api';
export { presentationService } from './services/presentationService';
export { agentService } from './services/agentService';
export { mockService } from './services/mockService';

// Hooks
export { usePresentation } from './hooks/usePresentation';
export { useTheme, ThemeProvider } from './context/ThemeContext';
export { useEditor } from './hooks/useEditor';
export { useWebSocket } from './hooks/useWebSocket';
export { useHotkeys } from './hooks/useHotkeys';

// Store
export { PresentationProvider, usePresentationContext } from './store/PresentationContext';
export * from './store/types';

// Utilities
export { parseMarpPresentation, parseDirectivesList, parseSlideDirectives } from './utils/marpParser';
export { insertMarkdownFormatting, countWordsAndChars, stripMarkdown } from './utils/markdownHelpers';
export { downloadMarkdownFile, downloadHtmlPresentation, triggerPrintToPdf } from './utils/exportHelpers';
