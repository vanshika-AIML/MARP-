import React, { useState } from 'react';
import { AlertCircle, Bot, Sparkles } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import { agentService } from '../../services/agentService';

export function AIAgentPanel({ onApplyMarkdown, wsStatus, onSimulateStream }) {
  const [prompt, setPrompt] = useState('');
  const [generationType, setGenerationType] = useState('slide');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async (event) => {
    event.preventDefault();
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      if (onSimulateStream) {
        await onSimulateStream(prompt, (markdown) => {
          onApplyMarkdown(markdown, generationType === 'deck');
        }, () => {
          setIsSubmitting(false);
          setPrompt('');
        });
      } else {
        const result = generationType === 'slide'
          ? await agentService.generateSlide(prompt)
          : await agentService.generateContent(prompt);
        const markdown = result?.generatedSlideMarkdown || result?.generatedMarkdown;
        if (markdown) onApplyMarkdown(markdown, generationType === 'deck');
        setIsSubmitting(false);
        setPrompt('');
      }
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <section className="h-full bg-white flex flex-col overflow-y-auto">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-slate-900">AI Presentation Agent</h2>
          <Badge variant={wsStatus === 'connected' ? 'green' : 'slate'} dot size="xs">
            {wsStatus === 'connected' ? 'Live' : 'Ready'}
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mt-1">Describe a slide or a complete deck to generate.</p>
      </div>

      <form onSubmit={handleGenerate} className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            ['slide', 'Single Slide', 'Append one slide'],
            ['deck', 'Full Slide Deck', 'Create a presentation'],
          ].map(([value, label, description]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGenerationType(value)}
              className={`p-3 rounded-md border text-left transition-colors ${generationType === value
                ? 'border-sky-500 bg-sky-50/60 text-sky-900'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <div className="text-xs font-semibold">{label}</div>
              <div className="text-[11px] text-slate-500 mt-1">{description}</div>
            </button>
          ))}
        </div>

        <Input
          label="Prompt"
          placeholder="e.g. Explain an event-driven architecture with Kafka"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />

        <div>
          <span className="text-[11px] font-medium text-slate-500 block mb-1.5">Quick Starters</span>
          <div className="flex flex-wrap gap-1.5">
            {['API Gateway vs Service Mesh', 'Q3 Product Roadmap', 'Zero Trust Security'].map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setPrompt(idea)}
                className="text-[11px] px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <Button variant="primary" size="sm" icon={Sparkles} type="submit" disabled={!prompt.trim() || isSubmitting} loading={isSubmitting}>
          Generate
        </Button>
      </form>
    </section>
  );
}

export default AIAgentPanel;