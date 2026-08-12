import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/2026_ecg_exam_triad_no_sync/" : "/",
}));
