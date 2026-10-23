/** Pure usage validation. No provider, credentials, storage, or comparison-tool imports. */
export function imageUsage(stage: "generation" | "verification", raw: unknown) {
  const u = raw as any;
  const valid = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
  if (stage === "generation") {
    const text = u?.input_tokens_details?.text_tokens, image = u?.input_tokens_details?.image_tokens;
    const input = u?.input_tokens, output = u?.output_tokens;
    if (![text, image, input, output, u?.total_tokens].every(valid) ||
        input <= 0 || output <= 0 || text + image !== input || input + output !== u.total_tokens) throw new Error("generation_usage_unknown");
    return { inputTokens: input, outputTokens: output, estimatedCostUSD: (text * 5 + image * 8 + output * 30) / 1e6 };
  }
  const input = u?.prompt_tokens, output = u?.completion_tokens;
  if (![input, output, u?.total_tokens].every(valid) || input <= 0 || output <= 0 || input + output !== u.total_tokens) throw new Error("verification_usage_unknown");
  return { inputTokens: input, outputTokens: output, estimatedCostUSD: (input * 2.5 + output * 10) / 1e6 };
}

export function imageRequestId(value: unknown): string | undefined {
  return typeof value === "string" && (/^req_[a-zA-Z0-9_-]{1,128}$/.test(value) ||
    /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)) ? value : undefined;
}
