import { describe, it, expect } from 'vitest';
import { StubEmbeddingProvider } from './embedding.stub.js';
describe('StubEmbeddingProvider', () => {
    it('is deterministic — same input gives same output', async () => {
        const e = new StubEmbeddingProvider(64);
        const a = await e.embed('federalism in ethiopia');
        const b = await e.embed('federalism in ethiopia');
        expect(a).toEqual(b);
    });
    it('produces L2-normalized vectors (norm ≈ 1)', async () => {
        const e = new StubEmbeddingProvider(128);
        const v = await e.embed('electrolysis');
        let sum = 0;
        for (const x of v)
            sum += x * x;
        expect(Math.sqrt(sum)).toBeCloseTo(1, 5);
    });
    it('shares more dimensions between related texts than unrelated ones', async () => {
        const e = new StubEmbeddingProvider(256);
        const a = await e.embed('electrolysis of water');
        const b = await e.embed('electrolysis in chemistry');
        const c = await e.embed('history of ethiopia federalism');
        const cos = (x, y) => {
            let dot = 0;
            for (let i = 0; i < x.length; i++)
                dot += (x[i] ?? 0) * (y[i] ?? 0);
            return dot;
        };
        const simAB = cos(a, b);
        const simAC = cos(a, c);
        expect(simAB).toBeGreaterThan(simAC);
    });
    it('respects configured dimension', async () => {
        const e = new StubEmbeddingProvider(16);
        const v = await e.embed('hello world');
        expect(v.length).toBe(16);
    });
});
//# sourceMappingURL=embedding.stub.test.js.map