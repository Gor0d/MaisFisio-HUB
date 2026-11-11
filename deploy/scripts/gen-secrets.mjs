// Gera POSTGRES_PASSWORD, JWT_SECRET e as chaves ANON/SERVICE_ROLE (HS256) e imprime no formato .env.
import { createHmac, randomBytes } from "node:crypto";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (payload, secret) => {
  const data = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`;
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
};
const jwtSecret = randomBytes(48).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const ten = 10 * 365 * 24 * 3600;
console.log(`POSTGRES_PASSWORD=${randomBytes(24).toString("hex")}`);
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ANON_KEY=${sign({ role: "anon", iss: "supabase", iat: now, exp: now + ten }, jwtSecret)}`);
console.log(`SERVICE_ROLE_KEY=${sign({ role: "service_role", iss: "supabase", iat: now, exp: now + ten }, jwtSecret)}`);
