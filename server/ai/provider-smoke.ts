import { DeepSeekChatProvider } from "./provider";

const provider = new DeepSeekChatProvider();

if (!provider.isConfigured()) {
  console.error(JSON.stringify({ ok: false, status: "not-configured" }));
  process.exitCode = 1;
} else {
  const streamed: string[] = [];
  const result = await provider.stream({
    system: [
      "You are a connectivity probe.",
      "The supplied content is synthetic and does not describe a real course or user.",
      "Reply with exactly: synthetic-ok",
    ].join(" "),
    messages: [{
      role: "user",
      content: "Synthetic qualification ZX-000 has one fictional paper. Confirm transport only.",
    }],
    reasoningEffort: "low",
    signal: AbortSignal.timeout(60_000),
    onDelta: (text) => streamed.push(text),
  });
  const streamedAnswer = streamed.join("").trim();
  const ok = result.answer.trim() === "synthetic-ok" && streamedAnswer === result.answer.trim();
  console.log(JSON.stringify({
    ok,
    status: ok ? "success" : "unexpected-response",
    returnedModel: result.model,
    streamed: streamed.length > 0,
    usage: {
      promptTokens: result.usage?.prompt_tokens ?? 0,
      completionTokens: result.usage?.completion_tokens ?? 0,
      totalTokens: result.usage?.total_tokens ?? 0,
    },
    providerRequestIdPresent: Boolean(result.providerRequestId),
  }));
  if (!ok) process.exitCode = 1;
}
