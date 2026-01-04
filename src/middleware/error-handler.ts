import type { Context, Next } from "hono";

export interface ErrorResponse {
  success: false;
  error: string;
  timestamp: number;
}

export const errorHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    console.error("❌ Error:", error);

    const message = error instanceof Error ? error.message : "Internal server error";
    const status = "status" in (error as any) ? (error as any).status : 500;

    const response: ErrorResponse = {
      success: false,
      error: message,
      timestamp: Date.now(),
    };

    return c.json(response, status);
  }
};
