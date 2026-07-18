import type { MetadataRoute } from "next";

// Sistema de uso interno da equipe MaisFisio: bloqueia indexação por buscadores.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
