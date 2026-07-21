import {
  AI_ASSISTANT_HISTORY_MAX_CHARACTERS,
  AI_ASSISTANT_HISTORY_MAX_MESSAGES,
  type AIChatMessage,
} from "./schema";

export function pruneAIChatHistory(
  messages: AIChatMessage[],
  maxMessages = AI_ASSISTANT_HISTORY_MAX_MESSAGES,
  maxCharacters = AI_ASSISTANT_HISTORY_MAX_CHARACTERS,
): AIChatMessage[] {
  const kept: AIChatMessage[] = [];
  let characters = 0;

  for (let index = messages.length - 1; index >= 0 && kept.length < maxMessages; index -= 1) {
    const message = messages[index];
    if (characters + message.content.length > maxCharacters && kept.length > 0) break;
    kept.unshift(message);
    characters += message.content.length;
  }

  return kept;
}

export function aiSessionStorageKey(contextKey: string): string {
  return `exambridge.ai.v1:${contextKey.replace(/[^a-zA-Z0-9:._-]+/g, "-").slice(0, 240)}`;
}
