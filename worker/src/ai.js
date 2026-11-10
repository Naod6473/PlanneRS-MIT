// Client de l'API Claude (bibliothèque officielle Anthropic). La clé vient du secret ANTHROPIC_API_KEY du Worker.
import Anthropic from "@anthropic-ai/sdk";

export function aiClient(env) {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60000 });
}
