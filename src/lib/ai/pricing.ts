/**
 * Published USD rates per million tokens, used only to estimate and cap spend.
 * Kept free of server-only imports so the cost maths can be unit tested.
 * Estimates are not billed amounts: reconcile against the provider invoice.
 */
export const modelPricing: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/** Whether a model's real rates are known, for admin display. */
export function isPricedModel(model: string) {
  return Object.hasOwn(modelPricing, model);
}

/**
 * Rate applied to a model missing from the table above. It is the most
 * expensive known tier on purpose: an unknown model must over-estimate, never
 * under-estimate. Returning zero would record every request as free, which
 * would silently disable the daily spend guard that reads those rows.
 */
const fallbackPrice = Object.values(modelPricing).reduce((worst, price) =>
  price.output > worst.output ? price : worst,
);

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
) {
  const price = modelPricing[model] ?? fallbackPrice;
  const cost =
    (Math.max(0, inputTokens) / 1_000_000) * price.input +
    (Math.max(0, outputTokens) / 1_000_000) * price.output;
  return Number(cost.toFixed(6));
}
