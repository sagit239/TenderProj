// The only place that talks to OpenAI: one Responses API call over all the tender's files
import OpenAI, { toFile } from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import type { LoadedFile } from "../files";
import { REANALYSIS_PROMPT, SYSTEM_PROMPT } from "./prompt";
import { REANALYSIS_SCHEMA, RESULT_SCHEMA, type AiReanalysisResult } from "./schema";

export const DEFAULT_MODEL = "gpt-6.1-sol";
const TIMEOUT_MS = 280_000;
const MAX_OUTPUT_TOKENS = 32_000;

export type AnalysisOutput = {
  // missing_ids is filled only on a re-analysis
  result: AiReanalysisResult;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

type ReadableFile = Extract<LoadedFile, { ok: true }>;

// existing: on a re-analysis, the text list of the items the tender already has
export async function analyzeTender(files: ReadableFile[], existing?: string): Promise<AnalysisOutput> {
  if (files.length === 0) throw new Error("No readable files to analyze");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  const uploadedIds: string[] = [];

  try {
    const content: ResponseInputContent[] = [
      { type: "input_text", text: `מסמכי המכרז (${files.length} קבצים):` },
    ];
    for (const file of files) {
      content.push({ type: "input_text", text: `=== קובץ: ${file.name} ===` });
      if (file.kind === "pdf") {
        const uploaded = await client.files.create(
          {
            file: await toFile(file.data, file.name, { type: "application/pdf" }),
            purpose: "user_data",
            // Safety net in case the delete below never runs
            expires_after: { anchor: "created_at", seconds: 3600 },
          },
          { signal: abort.signal },
        );
        uploadedIds.push(uploaded.id);
        content.push({ type: "input_file", file_id: uploaded.id });
      } else {
        content.push({ type: "input_text", text: file.text });
      }
    }
    if (existing !== undefined) {
      content.push({ type: "input_text", text: `=== הפריטים שכבר קיימים במכרז ===
${existing || "(אין)"}` });
    }

    const stream = client.responses.stream(
      {
        model,
        instructions: existing === undefined ? SYSTEM_PROMPT : `${SYSTEM_PROMPT}

${REANALYSIS_PROMPT}`,
        input: [{ role: "user", content }],
        max_output_tokens: MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: "json_schema",
            name: "tender_analysis",
            schema: existing === undefined ? RESULT_SCHEMA : REANALYSIS_SCHEMA,
            strict: true,
          },
        },
      },
      { signal: abort.signal },
    );
    const response = await stream.finalResponse();

    if (response.status !== "completed") {
      throw new Error(`Response ${response.status}: ${response.incomplete_details?.reason ?? "unknown"}`);
    }
    return {
      result: { missing_ids: [], ...(JSON.parse(response.output_text) as Partial<AiReanalysisResult>) } as AiReanalysisResult,
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  } finally {
    clearTimeout(timer);
    await Promise.allSettled(uploadedIds.map((id) => client.files.delete(id)));
  }
}
