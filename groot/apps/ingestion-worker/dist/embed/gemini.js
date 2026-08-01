export class GeminiEmbeddingProvider {
    constructor(apiKey, model = 'text-embedding-004', dimension = 768) {
        this.name = 'gemini';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        this.apiKey = apiKey;
        this.model = model;
        this.dimension = dimension;
    }
    async embed(text) {
        const res = await this.embedBatch([text]);
        return res[0];
    }
    async embedBatch(texts) {
        const url = `${this.baseUrl}/models/${this.model}:batchEmbedContents?key=${this.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: texts.map(text => ({
                    model: `models/${this.model}`,
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
}
//# sourceMappingURL=gemini.js.map