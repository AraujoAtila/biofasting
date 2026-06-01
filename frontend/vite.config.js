import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Configuração oficial e moderna do Tailwind v4 + Vite
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <-- O plugin agora gerencia os estilos perfeitamente!
  ],
});
