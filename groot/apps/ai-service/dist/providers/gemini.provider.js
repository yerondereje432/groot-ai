export class GeminiProvider {
    constructor(options) {
        this.name = 'gemini';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        this.apiKey = options.apiKey;
        this.generationModel = options.generationModel || 'gemini-1.5-flash';
        this.embeddingModel = options.embeddingModel || 'text-embedding-004';
        this.dimension = options.dimension || 768; // text-embedding-004 defaults to 768 but can be varied
    }
    async *stream(req) {
        const url = `${this.baseUrl}/models/${this.generationModel}:streamGenerateContent?key=${this.apiKey}`;
        const body = this.mapToGeminiBody(req.prompt, req.maxOutputTokens, req.stopSequences);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            throw new Error(`Gemini streaming error: ${response.statusText}`);
        }
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error('No reader for Gemini stream');
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            // Gemini sends JSON chunks in an array format [{}, {}, ...]
            // We need to parse them carefully. Simple split by ",\r\n" or similar
            // but standard approach for streamGenerateContent is NDJSON or a single JSON array stream.
            // Actually, streamGenerateContent returns chunks of JSON.
            // Heuristic parsing for the stream
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === '[' || trimmed === ']')
                    continue;
                const cleanLine = trimmed.startsWith(',') ? trimmed.slice(1) : trimmed;
                try {
                    const json = JSON.parse(cleanLine);
                    const delta = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (delta) {
                        yield { delta, done: false };
                    }
                }
                catch (e) {
                    // Incomplete JSON, put back in buffer
                    buffer = cleanLine + '\n' + buffer;
                }
            }
        }
        yield { delta: '', done: true };
    }
    async complete(req) {
        const url = `${this.baseUrl}/models/${this.generationModel}:generateContent?key=${this.apiKey}`;
        const body = this.mapToGeminiBody(req.prompt, req.maxOutputTokens, req.stopSequences);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            throw new Error(`Gemini error: ${response.statusText}`);
        }
        const data = (await response.json());
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
            content,
            usage: {
                input: data.usageMetadata?.promptTokenCount || 0,
                output: data.usageMetadata?.candidatesTokenCount || 0
            }
        };
    }
    async embed(text) {
        const url = `${this.baseUrl}/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: `models/${this.embeddingModel}`,
                content: { parts: [{ text }] },
                taskType: 'RETRIEVAL_QUERY',
                outputDimensionality: this.dimension
            })
        });
        if (!response.ok) {
            throw new Error(`Gemini embedding error: ${response.statusText}`);
        }
        const data = (await response.json());
        return data.embedding.values;
    }
    async embedBatch(texts) {
        const url = `${this.baseUrl}/models/${this.embeddingModel}:batchEmbedContents?key=${this.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: texts.map(text => ({
                    model: `models/${this.embeddingModel}`,
                    content: { parts: [{ text }] },
                    taskType: 'RETRIEVAL_DOCUMENT',
                    outputDimensionality: this.dimension
                }))
            })
        });
        if (!response.ok) {
            throw new Error(`Gemini batch embedding error: ${response.statusText}`);
        }
        const data = (await response.json());
        return data.embeddings.map((e) => e.values);
    }
    mapToGeminiBody(prompt, maxTokens, stop) {
        // Format curriculum excerpts into a clear context block
        const contextStr = prompt.context
            .map(c => `[Source: ${c.sourceRef}]\n${c.content}`)
            .join('\n\n---\n\n');
        return {
            system_instruction: {
                parts: [{ text: prompt.system }]
            },
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `CONTEXT:\n${contextStr}\n\nQUESTION: ${prompt.userQuery}` }]
                }
            ],
            generationConfig: {
                maxOutputTokens: maxTokens || 350,
                stopSequences: stop || ['\n\n\n']
            }
        };
    }
}
//# sourceMappingURL=gemini.provider.js.map