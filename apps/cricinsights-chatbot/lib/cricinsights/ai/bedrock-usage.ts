/** USD per 1M tokens (standard on-demand; override via env for your region). */
export type BedrockTokenRates = {
  inputPerMillion: number;
  outputPerMillion: number;
};

const DEFAULT_RATES: BedrockTokenRates = {
  inputPerMillion: 0.06,
  outputPerMillion: 0.24,
};

/** Prefix match — first hit wins. Env vars override everything. */
const MODEL_RATE_PREFIXES: Array<{ prefix: string; rates: BedrockTokenRates }> = [
  {
    prefix: 'amazon.nova-lite',
    rates: { inputPerMillion: 0.06, outputPerMillion: 0.24 },
  },
  {
    prefix: 'amazon.nova-micro',
    rates: { inputPerMillion: 0.035, outputPerMillion: 0.14 },
  },
  {
    prefix: 'amazon.nova-pro',
    rates: { inputPerMillion: 0.8, outputPerMillion: 3.2 },
  },
  {
    prefix: 'nvidia.nemotron',
    rates: { inputPerMillion: 0.06, outputPerMillion: 0.24 },
  },
  {
    prefix: 'openai.gpt-oss',
    rates: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },
  {
    prefix: 'anthropic.claude-haiku-4-5',
    rates: { inputPerMillion: 1.0, outputPerMillion: 5.0 },
  },
  {
    prefix: 'anthropic.claude-3-5-sonnet',
    rates: { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  },
  {
    prefix: 'anthropic.claude-3-5-haiku',
    rates: { inputPerMillion: 0.8, outputPerMillion: 4.0 },
  },
  {
    prefix: 'anthropic.claude-3-haiku',
    rates: { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  },
];

function parseEnvRate(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function resolveBedrockRates(modelId: string): BedrockTokenRates {
  const inputOverride = parseEnvRate('BEDROCK_INPUT_PRICE_PER_M');
  const outputOverride = parseEnvRate('BEDROCK_OUTPUT_PRICE_PER_M');
  if (inputOverride != null || outputOverride != null) {
    return {
      inputPerMillion: inputOverride ?? DEFAULT_RATES.inputPerMillion,
      outputPerMillion: outputOverride ?? DEFAULT_RATES.outputPerMillion,
    };
  }

  const normalized = modelId.toLowerCase();
  for (const entry of MODEL_RATE_PREFIXES) {
    if (normalized.includes(entry.prefix)) {
      return entry.rates;
    }
  }
  return DEFAULT_RATES;
}

export function estimateBedrockCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = resolveBedrockRates(modelId);
  return (
    (inputTokens / 1_000_000) * rates.inputPerMillion +
    (outputTokens / 1_000_000) * rates.outputPerMillion
  );
}

export function formatUsdCost(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.0001) return `$${amount.toFixed(6)}`;
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(4)}`;
}

export type BedrockUsageMeta = {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  steps: number;
  costUsd: number;
  costFormatted: string;
  inputPricePerM: number;
  outputPricePerM: number;
};

export function buildBedrockUsageMeta(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  steps: number,
): BedrockUsageMeta {
  const rates = resolveBedrockRates(modelId);
  const costUsd = estimateBedrockCostUsd(modelId, inputTokens, outputTokens);
  return {
    modelId,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    steps,
    costUsd,
    costFormatted: formatUsdCost(costUsd),
    inputPricePerM: rates.inputPerMillion,
    outputPricePerM: rates.outputPerMillion,
  };
}
