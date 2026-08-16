export class GeminiEmbeddingProvider {
    constructor(apiKey, model = 'gemini-embedding-2', dimension = 768) {
        this.name = 'gemini';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        this.apiKey = apiKey;
        this.model = model;
        this.dimension = dimension;
    }
    async embed(text) {
        const url = `${this.baseUrl}/models/${this.model}:embedContent?key=${this.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: `models/${this.model}`,
                content: { parts: [{ text }] },
                taskType: 'RETRIEVAL_DOCUMENT',
                outputDimensionality: this.dimension
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini embedding error: ${response.status} ${response.statusText}\nBody: ${errorText}`);
        }
        const data = (await response.json());
        return data.embedding.values;
    }
    async embedBatch(texts) {
        const results = [];
        for (const text of texts) {
            results.push(await this.embed(text));
        }
        return results;
    }
}
//# sourceMappingURL=gemini.js.map