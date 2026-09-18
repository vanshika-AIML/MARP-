export function shouldUseMockFallback(error) {
  return Boolean(error?.isNetworkError || error?.isTimeout);
}

export function isGenerationResponse(response) {
  return Boolean(response?.generatedSlideMarkdown || response?.generatedMarkdown || response?.markdown);
}

export function getGeneratedMarkdown(response, generationType) {
  if (generationType === 'slide') {
    return response?.generatedSlideMarkdown || response?.markdown || '';
  }
  return response?.generatedMarkdown || response?.markdown || '';
}
