import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Workspace from './Workspace';

vi.mock('./Sidebar', () => ({ default: () => <aside>Sidebar</aside> }));
vi.mock('../editor/CodeMirrorEditor', () => ({ default: () => <div>Markdown editor</div> }));
vi.mock('../editor/EditorToolbar', () => ({ default: () => <div>Editor toolbar</div> }));
vi.mock('../editor/MarkdownPreview', () => ({ default: () => <div>Rendered Presentation</div> }));
vi.mock('../editor/AIAgentPanel', () => ({ default: () => <aside>AI Presentation Agent</aside> }));

describe('Workspace view modes', () => {
  const props = {
    sidebarOpen: true,
    slides: [{ content: 'slide' }],
    activeSlide: 0,
    viewMode: 'split',
    theme: 'default',
    onToggleSidebar: vi.fn(),
    onSelectSlide: vi.fn(),
    onAddSlide: vi.fn(),
    onDuplicateSlide: vi.fn(),
    onDeleteSlide: vi.fn(),
    onOpenAiModal: vi.fn(),
    onMarkdownChange: vi.fn(),
    onEditorReady: vi.fn(),
    onEditorUpdate: vi.fn(),
    onFormat: vi.fn(),
    onChangeTheme: vi.fn(),
    onNextSlide: vi.fn(),
    onPrevSlide: vi.fn(),
    onPresent: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onGenerate: vi.fn(),
    onApplyMarkdown: vi.fn(),
  };

  it('renders the presentation and AI agent, without the Markdown editor, in split view', () => {
    render(<Workspace {...props} />);
    expect(screen.getByText('Rendered Presentation')).toBeInTheDocument();
    expect(screen.getByText('AI Presentation Agent')).toBeInTheDocument();
    expect(screen.queryByText('Markdown editor')).not.toBeInTheDocument();
    expect(document.querySelector('.split-design-toolbar')).toBeInTheDocument();
  });
  it.each(['editor', 'preview'])('preserves the %s view structure', (viewMode) => {
    render(<Workspace {...props} viewMode={viewMode} />);
    expect(screen.getByText('Sidebar')).toBeInTheDocument();
    expect(screen.queryByText('AI Presentation Agent')).not.toBeInTheDocument();
    if (viewMode === 'editor') {
      expect(screen.getByText('Markdown editor')).toBeInTheDocument();
      expect(screen.queryByText('Rendered Presentation')).not.toBeInTheDocument();
    } else {
      expect(screen.getByText('Rendered Presentation')).toBeInTheDocument();
      expect(screen.queryByText('Markdown editor')).not.toBeInTheDocument();
    }
  });
});
