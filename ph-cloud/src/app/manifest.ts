import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    // "fullscreen" no Android; no iPhone, instalar na Tela de Início é o jeito de jogar sem a barra do Safari.
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    background_color: "#060808",
    theme_color: "#060808",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
