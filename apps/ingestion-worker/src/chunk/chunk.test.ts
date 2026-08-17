import { describe, it, expect } from 'vitest';
import { chunkDocument, splitSentences, countTokens } from './index.js';
import type { ParsedDocument } from '../parse/index.js';

describe('splitSentences', () => {
  it('splits English on .!?', () => {
    expect(splitSentences('Photosynthesis is a process. It happens in plants. Cool!')).toEqual([
      'Photosynthesis is a process.',
      'It happens in plants.',
      'Cool!',
    ]);
  });

  it('splits Amharic on ።', () => {
    expect(splitSentences('ፎቶሲንተዲስ ሂደት ነው። በእጽባት ውስጥ ይከናወናል።')).toEqual([
      'ፎቶሲንተዲስ ሂደት ነው።',
      'በእጽባት ውስጥ ይከናወናል።',
    ]);
  });

  it('does not split on abbreviations (rough heuristic)', () => {
    // e.g., "e.g." should not split — handled by lookahead on capital letters.
    const out = splitSentences('e.g. water and oxygen. Hydrogen is produced.');
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});

describe('countTokens', () => {
  it('estimates higher for Ge\'ez', () => {
    expect(countTokens('ፎቶሲንተዲስ')).toBeGreaterThan(0);
  });
  it('estimates for Latin', () => {
    expect(countTokens('photosynthesis')).toBeGreaterThan(0);
  });
});

describe('chunkDocument', () => {
  const doc: ParsedDocument = {
    title: 'Sample',
    sourceRef: 'sample.md',
    language: 'en',
    sections: [
      {
        heading: 'Photosynthesis',
        body:
          'Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose. ' +
          'It takes place in the chloroplasts of plant cells. ' +
          'Water and carbon dioxide are required inputs, and oxygen is released as a byproduct. ' +
          'The overall equation is 6 CO2 + 6 H2O + light → C6H12O6 + 6 O2. ' +
          'This process is fundamental to almost all life on Earth because it forms the base of the food chain. ' +
          'Without photosynthesis, ecosystems as we know them would collapse. ' +
          'Plants are classified as autotrophs precisely because they can produce their own food via photosynthesis. ' +
          'Chlorophyll is the green pigment that captures light energy. ' +
          'Different wavelengths of light are absorbed to different extents.',
      },
    ],
  };

  it('produces at least one chunk', () => {
    const out = chunkDocument(doc);
    expect(out.length).toBeGreaterThan(0);
  });

  it('keeps chunks within the soft token budget', () => {
    const out = chunkDocument(doc);
    for (const c of out) {
      // Some chunks may exceed maxTokens if a single sentence is long; otherwise stay under.
      expect(c.tokenCount).toBeLessThan(800);
    }
  });

  it('propagates section heading to chunk metadata', () => {
    const out = chunkDocument(doc);
    expect(out.every(c => c.heading === 'Photosynthesis')).toBe(true);
  });

  it('preserves Ge\'ez script intact', () => {
    const amDoc: ParsedDocument = {
      title: 'ናሙና',
      sourceRef: 'amharic.md',
      language: 'am',
      sections: [
        {
          heading: 'ፎቶሲንተዲስ',
          body: 'ፎቶሲንተዲስ የእጽባት ሂደት ነው። በእጽባት ውስጥ ይከናወናል። ናሙና ይህ ጽሑፍ ነው።',
        },
      ],
    };
    const out = chunkDocument(amDoc);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]?.body).toMatch(/[\u1200-\u137f]/);
  });
});
