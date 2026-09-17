/**
 * GenerationOverlay & AI Generator Modal Component
 * Displays WebSocket generation status and provides an AI prompt dialog
 * to trigger slide synthesis via agentService / WebSocket.
 */
import React, { useState } from 'react';
import { Sparkles, Bot, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { ProgressBar } from '../ui/Spinner';
import Badge from '../ui/Badge';
import { agentService } from '../../services/agentService';

export function GenerationOverlay({
  isOpen,
  onClose,
  onApplyMarkdown,
  wsStatus,
  wsEventState,
  onSimulateStream,
}) {
  const [prompt, setPrompt] = useState('');
  const [generationType, setGenerationType] = useState('slide'); // 'slide' | 'deck'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isGenerating =
    wsEventState?.type === 'generating' ||
    wsEventState?.type === 'generating_slide' ||
    wsEventState?.type === 'rendering';

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (wsStatus !== 'connected' && onSimulateStream) {
        // Run simulated streaming WebSocket demo
        await onSimulateStream(
          prompt,
          (generatedMarkdown) => {
            if (onApplyMarkdown) {
              onApplyMarkdown(generatedMarkdown, generationType === 'deck');
            }
          },
          () => {
            setIsSubmitting(false);
            setTimeout(() => {
              onClose();
              setPrompt('');
            }, 1000);
          },
          generationType
        );
      } else {
        // Direct Service invocation fallback
        if (generationType === 'slide') {
          const res = await agentService.generateSlide(prompt);
          if (res?.generatedSlideMarkdown && onApplyMarkdown) {
            onApplyMarkdown(res.generatedSlideMarkdown, false);
          }
        } else {
          const res = await agentService.generateContent(prompt);
          if (res?.generatedMarkdown && onApplyMarkdown) {
            onApplyMarkdown(res.generatedMarkdown, true);
          }
        }
        setIsSubmitting(false);
        onClose();
        setPrompt('');
      }
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isGenerating ? () => {} : onClose}
      title="AI Presentation Assistant"
      subtitle="Generate slides or complete decks using real-time MARP agent"
      maxWidth="max-w-md"
      showClose={!isGenerating}
    >
      <div className="space-y-4">
        {/* WebSocket Connection Status */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-medium text-slate-700">Agent WebSocket</span>
          </div>
          <Badge
            variant={wsStatus === 'connected' ? 'green' : wsStatus === 'connecting' ? 'amber' : 'slate'}
            dot
            size="xs"
          >
            {wsStatus === 'connected' ? 'Live Stream' : wsStatus === 'connecting' ? 'Connecting' : 'Simulated / Ready'}
          </Badge>
        </div>

        {/* Prompt Form */}
        {!isGenerating ? (
          <form onSubmit={handleGenerate} className="space-y-3.5">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Generation Target
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGenerationType('slide')}
                  className={`p-2 rounded-md border text-xs font-medium text-left transition-all ${
                    generationType === 'slide'
                      ? 'border-sky-500 bg-sky-50/50 text-sky-900'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold">Single Slide</div>
                  <div className="text-[11px] text-slate-500">Append 1 new slide to deck</div>
                </button>

                <button
                  type="button"
                  onClick={() => setGenerationType('deck')}
                  className={`p-2 rounded-md border text-xs font-medium text-left transition-all ${
                    generationType === 'deck'
                      ? 'border-sky-500 bg-sky-50/50 text-sky-900'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold">Full Slide Deck</div>
                  <div className="text-[11px] text-slate-500">Create full presentation</div>
                </button>
              </div>
            </div>

            <div>
              <Input
                label="Topic or Instruction"
                placeholder="e.g. Microservices event sourcing architecture with Kafka and Redis"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                autoFocus
              />
            </div>

            {/* Quick Prompt Ideas */}
            <div>
              <span className="text-[11px] font-medium text-slate-500 block mb-1.5">
                Quick Starters
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'API Gateway vs Service Mesh',
                  'Q3 Product Roadmap Review',
                  'Cloud Security Zero Trust Model',
                  'Executive Pitch: AI Agent Platform',
                ].map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setPrompt(idea)}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Sparkles}
                type="submit"
                disabled={!prompt.trim() || isSubmitting}
                loading={isSubmitting}
              >
                Generate
              </Button>
            </div>
          </form>
        ) : (
          /* Live Streaming Generation Progress */
          <div className="py-6 space-y-4 text-center">
            <div className="inline-flex p-3 bg-sky-50 rounded-full text-sky-600 animate-pulse">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-slate-900">
                {wsEventState?.message || 'Generating slide content...'}
              </h4>
              <p className="text-xs text-slate-500">
                Event: <code className="font-mono text-sky-600">{wsEventState?.type}</code>
              </p>
            </div>

            <ProgressBar
              progress={wsEventState?.progress || 45}
              statusText={wsEventState?.message}
              className="max-w-xs mx-auto"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default GenerationOverlay;
