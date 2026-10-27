import { createHttpBackend } from "./backends/http";
import type { Backend } from "./types";

/**
 * The app's single data source: Mova's Spring Boot backend (backend/ folder, data in
 * PostgreSQL), which Next.js proxies at /api.
 */
export const api: Backend = createHttpBackend();
