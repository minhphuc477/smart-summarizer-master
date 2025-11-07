import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Rough token estimator (Groq llama ~4 chars per token typical)
function estimateTokens(str: string) {
  return Math.ceil(str.length / 4);
}

interface GroqSummaryResult {
  summary: string;
  takeaways: string[];
  actions: { task: string; datetime: string | null }[];
  tags: string[];
  sentiment: string;
  meta?: { truncated?: boolean; chunked?: boolean; original_length?: number; used_length?: number; chunks?: number };
}

/**
 * getGroqSummary safeguards against oversized inputs (413) by:
 * 1. Truncating extremely long content.
 * 2. Chunking when moderately large (> ~5500 tokens) then performing a second pass on merged chunk summaries.
 * The final persona formatting & JSON contract is enforced in the last call.
 */
export async function getGroqSummary(notes: string, customPersona: string): Promise<GroqSummaryResult> {
  const personaDescription = customPersona || "an expert summarization assistant";
  const MAX_TOKENS_SINGLE_CALL = 5500; // stay under 6000 TPM budget
  const HARD_CHAR_LIMIT = 24000; // absolute safety cutoff (~6000 tokens)

  const originalLength = notes.length;
  let workingText = notes;
  let truncated = false;
  if (workingText.length > HARD_CHAR_LIMIT) {
    workingText = workingText.slice(0, HARD_CHAR_LIMIT);
    truncated = true;
  }

  const tokenEstimate = estimateTokens(workingText);
  const needChunking = tokenEstimate > MAX_TOKENS_SINGLE_CALL;

  // Helper to call Groq with standardized system prompt & raw content
  async function callGroq(content: string, finalPass: boolean): Promise<GroqSummaryResult> {
    const system_prompt = `
    Your primary role is to analyze text. Your response MUST be delivered in a specific persona.
    **CRITICAL INSTRUCTION: You must adopt the persona of "${personaDescription}".** 
    Your entire writing style—word choice, tone, and focus—for the 'summary' and 'takeaways' MUST reflect this persona. The 'actions' should remain direct and clear.
    After adopting the persona, you must provide the output ONLY in a valid JSON format with FIVE keys:
      1. "summary" (string)
      2. "takeaways" (string[])
      3. "actions" ( { task: string; datetime: string | null }[] )
      4. "tags" (string[] length 3-5)
      5. "sentiment" ("positive" | "neutral" | "negative")
    IMPORTANT datetime detection guidance:
      - Convert explicit times/dates mentioned to ISO 8601 with timezone if possible; else null.
      - Use current date reference: ${new Date().toISOString().split('T')[0]}
    ${finalPass ? "The input may already be summarized chunks; merge them cohesively, avoid duplication." : ""}
    Do not add any text before or after the JSON object.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.65,
      response_format: { type: "json_object" },
    });
    const aiResponseContent = chatCompletion.choices[0]?.message?.content;
    if (!aiResponseContent) {
      throw new Error("Received an empty response from the AI.");
    }
    return JSON.parse(aiResponseContent);
  }

  if (!needChunking) {
    const result = await callGroq(workingText, true);
    return { ...result, meta: { truncated, original_length: originalLength, used_length: workingText.length } };
  }

  // Chunking path: split by paragraphs, group until near threshold
  const paragraphs = workingText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (estimateTokens(current + "\n\n" + p) > MAX_TOKENS_SINGLE_CALL - 500) { // leave buffer
      if (current) chunks.push(current);
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current) chunks.push(current);

  // Summarize each chunk individually with a lighter persona prompt (finalPass=false)
  const intermediateSummaries: GroqSummaryResult[] = [];
  for (const chunk of chunks) {
    try {
      const partial = await callGroq(chunk, false);
      intermediateSummaries.push(partial);
    } catch (e) {
      // Fail soft: continue with what we have
      console.warn("Chunk summarization failed", e);
    }
  }

  const mergedInput = intermediateSummaries.map((s, i) => `Chunk ${i + 1} Summary:\n${s.summary}\nKey Points: ${s.takeaways.join('; ')}`).join("\n\n");
  const final = await callGroq(mergedInput, true);
  return {
    ...final,
    meta: {
      truncated,
      chunked: true,
      original_length: originalLength,
      used_length: workingText.length,
      chunks: chunks.length,
    }
  };
}