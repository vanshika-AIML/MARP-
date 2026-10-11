import api from './api';

export const AI_ACTIONS = [
  ['slide', 'Add slide', 'optional'], ['deck', 'Generate deck', 'optional'],
  ['generate_outline', 'Generate outline', 'optional'], ['rewrite_slide', 'Rewrite active slide', 'slide'],
  ['shorten_slide', 'Shorten active slide', 'slide'], ['expand_slide', 'Expand active slide', 'slide'],
  ['simplify_slide', 'Simplify active slide', 'slide'], ['change_tone', 'Change tone', 'slide'],
  ['make_professional', 'Make professional', 'slide'], ['make_creative', 'Make creative', 'slide'],
  ['make_technical', 'Make technical', 'slide'], ['improve_storytelling', 'Improve storytelling', 'slide'],
  ['generate_agenda', 'Add agenda', 'optional'], ['generate_conclusion', 'Add conclusion', 'optional'],
  ['generate_speaker_notes', 'Generate speaker notes', 'slide'], ['suggest_visuals', 'Suggest visuals', 'slide'],
  ['split_slide', 'Split active slide', 'slide'], ['merge_slides', 'Merge active + next', 'merge'],
  ['improve_entire_deck', 'Improve entire deck', 'deck'], ['reorder_suggestions', 'Suggest order', 'deck'],
];
export const actionName = (action) => ({ slide: 'generate_single_slide', deck: 'generate_full_deck' }[action] || action);
export const agentService = {
  createJob(request, options = {}) { return api.post('/ai/jobs', request, options); },
  getJob(id, options = {}) { return api.get(`/ai/jobs/${encodeURIComponent(id)}`, options); },
  cancelJob(id) { return api.post(`/ai/jobs/${encodeURIComponent(id)}/cancel`, {}); },
};
export default agentService;
