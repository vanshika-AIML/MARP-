import agentService from './agentService';
import { getGeneratedMarkdown, isGenerationResponse } from './fallback';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function generatePresentation(prompt, generationType = 'slide', context = '') {
  const response = generationType === 'slide'
    ? await agentService.generateSlide(prompt)
    : await agentService.generateContent(prompt, context);

  if (isGenerationResponse(response)) {
    return getGeneratedMarkdown(response, generationType);
  }

  const taskId = response?.taskId || response?.task_id;
  if (!taskId) {
    throw new Error('The generation service returned no content or task ID.');
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await agentService.getGenerationStatus(taskId);
    const generatedMarkdown = getGeneratedMarkdown(status, generationType);
    if (generatedMarkdown) return generatedMarkdown;
    if (['failed', 'error', 'cancelled'].includes(status?.status)) {
      throw new Error(status?.message || status?.detail || 'Generation failed.');
    }
    if (['completed', 'success'].includes(status?.status) && !generatedMarkdown) {
      throw new Error('Generation completed without returning Markdown.');
    }
    await wait(500);
  }

  throw new Error('Generation timed out while waiting for the backend.');
}
