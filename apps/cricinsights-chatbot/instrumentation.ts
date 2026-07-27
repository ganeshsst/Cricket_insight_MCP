import { OpenTelemetry } from "@ai-sdk/otel";
import { registerOTel } from "@vercel/otel";
import { registerTelemetry, type Telemetry } from "ai";

export function register() {
  registerOTel({ serviceName: "chatbot" });
  // @ai-sdk/otel OpenTelemetry implements the runtime contract; cast for SDK type drift.
  registerTelemetry(new OpenTelemetry() as unknown as Telemetry);
}
