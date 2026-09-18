import { describe, expect, it, vi } from 'vitest';
import agentService from './agentService';
import { generatePresentation } from './generationService';

vi.mock('./agentService', () => ({
  default: {
    generateSlide: vi.fn(),
    generateContent: vi.fn(),
    getGenerationStatus: vi.fn(),
  },
}));

describe('generatePresentation', () => {
  it('uses the real agent service for normal slide generation', async () => {
    agentService.generateSlide.mockResolvedValue({ generatedSlideMarkdown: '\n---\n# Real slide' });
    const result = await generatePresentation('topic', 'slide');

    expect(agentService.generateSlide).toHaveBeenCalledWith('topic');
    expect(result).toContain('Real slide');
  });

  it('uses full-deck generation rather than one-slide simulation', async () => {
    agentService.generateContent.mockResolvedValue({ generatedMarkdown: '# Full deck\n\n---\n\n# Two' });
    const result = await generatePresentation('topic', 'deck');

    expect(agentService.generateContent).toHaveBeenCalledWith('topic', '');
    expect(result).toContain('# Two');
  });
});
