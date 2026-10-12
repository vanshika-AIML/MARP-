import { expect, it } from 'vitest';
import * as studio from './index';

it('exports the public embeddable components and services', () => {
  expect(studio.Dashboard).toBeTypeOf('function');
  expect(studio.App).toBeTypeOf('function');
  expect(studio.presentationService.createPresentation).toBeTypeOf('function');
});
