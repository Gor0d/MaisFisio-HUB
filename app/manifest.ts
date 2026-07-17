import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MaisFisio — Indicadores Assistenciais",
    short_name: "MaisFisio",
    description: "Coleta e acompanhamento de indicadores assistenciais",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7faf9",
    theme_color: "#087f5b",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
