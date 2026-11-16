// Acesso sem e-mail (fase provisória, enquanto não há SMTP institucional):
// o gestor cria a conta com uma senha provisória gerada aqui, repassa à pessoa
// e ela é obrigada a trocar no primeiro acesso. A marca fica em app_metadata,
// que só o service_role altera — o próprio usuário não consegue removê-la sem
// de fato trocar a senha pela ação do servidor.
export const MUST_CHANGE_PASSWORD = "must_change_password";

// Sem caracteres ambíguos (0/O, 1/l/I) para quem vai digitar no celular.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

// Web Crypto (existe no Node e no runtime Edge do middleware, que importa este
// arquivo). Amostragem por rejeição para não enviesar o sorteio.
function randomIndex(max: number) {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= limit);
  return buffer[0] % max;
}

// 3 blocos de 4 = 12 caracteres (~68 bits), ex.: "kT7m-Qx4p-Hr9w".
export function generateProvisionalPassword() {
  const block = () => Array.from({ length: 4 }, () => ALPHABET[randomIndex(ALPHABET.length)]).join("");
  return `${block()}-${block()}-${block()}`;
}

export function mustChangePassword(user: { app_metadata?: Record<string, unknown> } | null | undefined) {
  return user?.app_metadata?.[MUST_CHANGE_PASSWORD] === true;
}

// Enquanto a senha provisória não for trocada, só estas rotas respondem:
// a tela de troca (e o "Sair", que é uma server action postada nela), o
// callback do Auth e o health check.
export function allowedDuringPasswordChange(path: string) {
  return path === "/definir-senha" || path.startsWith("/auth/") || path.startsWith("/api/health");
}
