import { defineConfig } from "vite";
import betterEnums from "vite-plugin-better-enums";

export default defineConfig({
  build: {
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
    },
  },
  plugins: [betterEnums()],
});
