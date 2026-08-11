import { defineConfig } from "vite";

// GitHub Pages serves a project repo (not a username.github.io repo) from
// a subpath: https://<user>.github.io/<repo-name>/ — without `base` set to
// match, every asset reference in the built index.html would point at the
// site ROOT instead of that subpath, and the page would load blank (JS/CSS
// 404s). Replace REPO-NAME below with your actual repository name, exactly
// as it appears in the GitHub URL (case-sensitive).
//
// Conditional on `command`, not a fixed value: applying "/REPO-NAME/" during
// `npm run dev` too would move the local dev server off localhost:5173/ and
// onto localhost:5173/REPO-NAME/ for no reason - the subpath only matters
// once this is actually served from GitHub Pages (i.e. during `npm run build`).
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/REPO-NAME/" : "/",
}));
