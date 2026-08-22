/**
 * CodeMirrorEditor Component
 * Wrapper around @uiw/react-codemirror with markdown syntax mode,
 * line numbers, light developer-tool theme, and cursor update hooks.
 */
import React, { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { githubLight } from '@uiw/codemirror-theme-github';

export function CodeMirrorEditor({
  value,
  onChange,
  onEditorReady,
  onEditorUpdate,
  className = '',
}) {
  const handleEditorCreate = useCallback((view) => {
    if (onEditorReady) {
      onEditorReady(view);
    }
  }, [onEditorReady]);

  return (
    <div className={`w-full h-full relative overflow-hidden text-left ${className}`}>
      <CodeMirror
        value={value}
        height="100%"
        theme={githubLight}
        extensions={[markdown()]}
        onChange={onChange}
        onCreateEditor={handleEditorCreate}
        onUpdate={onEditorUpdate}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          history: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: false,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: false,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
        className="h-full w-full"
      />
    </div>
  );
}

export default CodeMirrorEditor;
