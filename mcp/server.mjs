#!/usr/bin/env node
// Servidor MCP do MaisFisio HUB.
//
// Entra no Supabase como um USUÁRIO do sistema (e-mail e senha), nunca com a
// service_role: a RLS e as regras do banco valem como na tela. Só admin/matriz
// criam ou alteram indicadores de qualidade, e só nas unidades a que pertencem.
//
// Variáveis: MAISFISIO_SUPABASE_URL, MAISFISIO_SUPABASE_ANON_KEY,
//            MAISFISIO_EMAIL, MAISFISIO_PASSWORD.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { computeValue, describeFormula, formatNumber, missingReason, monthRange, previousMonth, resolveIndicatorCodes, targetStatus } from "./lib.mjs";

const env = (name) => { const v = process.env[name]; if (!v) throw new Error(`Defina ${name} na configuração do servidor MCP.`); return v; };

let session = null;
async function ctx() {
  if (session) return session;
  const supabase = createClient(env("MAISFISIO_SUPABASE_URL"), env("MAISFISIO_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: true } });
  const { data, error } = await supabase.auth.signInWithPassword({ email: env("MAISFISIO_EMAIL"), password: env("MAISFISIO_PASSWORD") });
  if (error) throw new Error(`Falha no login do MaisFisio HUB: ${error.message}`);
  const { data: profile, error: pErr } = await supabase.from("profiles").select("role,full_name").eq("user_id", data.user.id).single();
  if (pErr) throw pErr;
  const { data: units, error: uErr } = await supabase.from("units").select("id,code,name").order("name");
  if (uErr) throw uErr;
  session = { supabase, user: data.user, role: profile.role, name: profile.full_name, units: units ?? [] };
  return session;
}

function resolveUnit(s, code) {
  if (code) {
    const unit = s.units.find((u) => u.code === code || u.id === code);
    if (!unit) throw new Error(`Unidade "${code}" não encontrada ou sem acesso. Unidades: ${s.units.map((u) => u.code).join(", ")}.`);
    return unit;
  }
  if (s.units.length === 1) return s.units[0];
  throw new Error(`Informe a unidade (código). Disponíveis: ${s.units.map((u) => u.code).join(", ")}.`);
}

function requireManager(s) {
  if (!["admin", "super_admin"].includes(s.role)) throw new Error("Só administradores da unidade ou a matriz gerenciam indicadores de qualidade.");
}

async function catalog(s) {
  const { data, error } = await s.supabase.from("indicators").select("id,code,name,kind,context,active,derived,display_order,services(code,name)").order("display_order");
  if (error) throw error;
  return (data ?? []).map((i) => ({ ...i, service: Array.isArray(i.services) ? i.services[0] : i.services }));
}

async function sectorsOf(s, unitId) {
  const { data, error } = await s.supabase.from("sectors").select("id,code,name").eq("unit_id", unitId).order("name");
  if (error) throw error;
  return data ?? [];
}

async function servicesByCode(s) {
  const { data, error } = await s.supabase.from("services").select("id,code,name");
  if (error) throw error;
  return new Map((data ?? []).map((x) => [x.code, x]));
}

const ok = (payload) => ({ content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e?.message ?? e) }] });
const wrap = (fn) => async (args) => { try { return ok(await fn(args ?? {})); } catch (e) { return fail(e); } };

// Soma dos indicadores escolhidos no período, a partir dos totais agregados do banco.
async function sumCodes(s, unitId, start, end, ids, sectorIds) {
  if (!ids.length) return null;
  const sectors = sectorIds.length ? sectorIds : [null];
  let total = null;
  for (const sector of sectors) {
    const { data, error } = await s.supabase.rpc("production_metrics_totals", { p_start: start, p_end: end, p_unit: unitId, p_service: null, p_sector: sector });
    if (error) throw error;
    for (const row of data ?? []) if (ids.includes(row.indicator_id) && row.total !== null) total = (total ?? 0) + Number(row.total);
  }
  return total;
}

const formulaShape = {
  unidade: z.string().optional().describe("Código da unidade (ex.: galileu). Opcional se o usuário tiver uma só."),
  nome: z.string().min(3).max(160).describe("Nome como aparece no portal Interact, ex.: 'FON - Índice de broncoaspiração - UTI'."),
  codigo_interact: z.string().max(60).optional().describe("Código do indicador no Interact, se houver."),
  numerador: z.array(z.string()).min(1).describe("Códigos de indicadores de contagem do catálogo somados no numerador."),
  denominador: z.array(z.string()).default([]).describe("Códigos somados no denominador. Vazio = o resultado é a soma do numerador."),
  setores: z.array(z.string()).default([]).describe("Códigos de setores para filtrar (vazio = todos)."),
  multiplicador: z.number().positive().default(100).describe("100 para %, 1000 para ‰. Ignorado sem denominador."),
  unidade_resultado: z.string().max(30).default("%").describe("Ex.: %, ‰, atendimentos."),
  casas_decimais: z.number().int().min(0).max(6).default(2),
  meta: z.number().optional().describe("Valor da meta."),
  tipo_meta: z.enum(["minimo", "maximo"]).optional().describe("minimo = maior é melhor; maximo = menor é melhor."),
  observacoes: z.string().max(1000).optional(),
};

async function buildPayload(s, args) {
  const unit = resolveUnit(s, args.unidade);
  const cat = await catalog(s);
  const num = resolveIndicatorCodes(args.numerador, cat, "Numerador");
  const den = resolveIndicatorCodes(args.denominador ?? [], cat, "Denominador");
  const sectors = await sectorsOf(s, unit.id);
  const missing = (args.setores ?? []).filter((c) => !sectors.some((x) => x.code === c));
  if (missing.length) throw new Error(`Setor(es) inexistente(s) em ${unit.code}: ${missing.join(", ")}. Use listar_setores.`);
  if ((args.meta === undefined) !== (args.tipo_meta === undefined)) throw new Error("Informe meta e tipo_meta juntos (ou nenhum dos dois).");
  const services = await servicesByCode(s);
  const serviceCode = num[0].service?.code;
  return {
    unit,
    names: new Map([...num, ...den].map((i) => [i.id, `${i.service?.name ?? ""} · ${i.name}`])),
    payload: {
      name: args.nome.trim(),
      interact_code: args.codigo_interact?.trim() || null,
      service_id: serviceCode ? services.get(serviceCode)?.id ?? null : null,
      numerator_ids: num.map((i) => i.id),
      denominator_ids: den.map((i) => i.id),
      sector_ids: sectors.filter((x) => (args.setores ?? []).includes(x.code)).map((x) => x.id),
      multiplier: den.length ? args.multiplicador ?? 100 : 1,
      result_unit: args.unidade_resultado ?? "%",
      decimals: args.casas_decimais ?? 2,
      target_value: args.meta ?? null,
      target_comparison: args.tipo_meta ?? null,
      notes: args.observacoes ?? null,
    },
  };
}

const server = new McpServer({ name: "maisfisio-hub", version: "0.1.0" }, {
  instructions: "Ferramentas do MaisFisio HUB (indicadores assistenciais hospitalares). Para criar um indicador de qualidade do portal Interact: (1) listar_indicadores_producao para achar os códigos de contagem; (2) previa_indicador_qualidade para conferir o resultado de um mês; (3) criar_indicador_qualidade. Fórmula: soma(numerador) ÷ soma(denominador) × multiplicador no mês. Nunca invente códigos. Dados são agregados; não há dados de pacientes nestas ferramentas.",
});

server.registerTool("quem_sou_eu", { title: "Usuário conectado", description: "Mostra o usuário do MaisFisio HUB usado pelo MCP, o papel e as unidades acessíveis.", inputSchema: {}, annotations: { readOnlyHint: true } },
  wrap(async () => { const s = await ctx(); return { email: s.user.email, nome: s.name, papel: s.role, unidades: s.units.map(({ code, name }) => ({ codigo: code, nome: name })) }; }));

server.registerTool("listar_indicadores_producao", {
  title: "Catálogo de indicadores de produção",
  description: "Lista os indicadores lançados pela equipe (por serviço). Só os de tipo 'contagem' não derivados entram em fórmulas de qualidade.",
  inputSchema: { servico: z.string().optional().describe("Código do serviço: fisioterapia, terapia_ocupacional, psicologia, fonoaudiologia, assistencia_social."), apenas_para_formula: z.boolean().default(true) },
  annotations: { readOnlyHint: true },
}, wrap(async ({ servico, apenas_para_formula = true }) => {
  const s = await ctx();
  return (await catalog(s))
    .filter((i) => i.active && (!servico || i.service?.code === servico) && (!apenas_para_formula || (i.kind === "contagem" && !i.derived)))
    .map((i) => ({ codigo: i.code, nome: i.name, servico: i.service?.code, contexto: i.context, tipo: i.kind, derivado: i.derived }));
}));

server.registerTool("listar_setores", { title: "Setores da unidade", description: "Setores de uma unidade (para filtrar fórmulas, ex.: só UTI).", inputSchema: { unidade: z.string().optional() }, annotations: { readOnlyHint: true } },
  wrap(async ({ unidade }) => { const s = await ctx(); const unit = resolveUnit(s, unidade); return (await sectorsOf(s, unit.id)).map(({ code, name }) => ({ codigo: code, nome: name })); }));

server.registerTool("listar_indicadores_qualidade", {
  title: "Indicadores de qualidade cadastrados",
  description: "Lista os indicadores de qualidade (Interact) da unidade com a fórmula em texto e a meta.",
  inputSchema: { unidade: z.string().optional(), incluir_inativos: z.boolean().default(false) },
  annotations: { readOnlyHint: true },
}, wrap(async ({ unidade, incluir_inativos = false }) => {
  const s = await ctx(); requireManager(s); const unit = resolveUnit(s, unidade);
  let q = s.supabase.from("quality_indicators").select("*").eq("unit_id", unit.id).order("name");
  if (!incluir_inativos) q = q.eq("active", true);
  const { data, error } = await q; if (error) throw error;
  const names = new Map((await catalog(s)).map((i) => [i.id, `${i.service?.name ?? ""} · ${i.name}`]));
  return (data ?? []).map((x) => ({ id: x.id, nome: x.name, codigo_interact: x.interact_code, formula: describeFormula(x, names), unidade_resultado: x.result_unit, casas_decimais: x.decimals, meta: x.target_value === null ? null : `${x.target_comparison === "maximo" ? "máx." : "mín."} ${x.target_value}`, ativo: x.active, observacoes: x.notes }));
}));

server.registerTool("previa_indicador_qualidade", {
  title: "Prévia de um indicador (sem salvar)",
  description: "Calcula a fórmula proposta para um mês, sem gravar nada. Use antes de criar_indicador_qualidade para conferir se o número faz sentido.",
  inputSchema: { ...formulaShape, mes: z.string().describe("AAAA-MM") },
  annotations: { readOnlyHint: true },
}, wrap(async (args) => {
  const s = await ctx(); requireManager(s);
  const { unit, names, payload } = await buildPayload(s, args);
  const { start, end } = monthRange(args.mes);
  const numerator = await sumCodes(s, unit.id, start, end, payload.numerator_ids, payload.sector_ids);
  const denominator = payload.denominator_ids.length ? await sumCodes(s, unit.id, start, end, payload.denominator_ids, payload.sector_ids) : null;
  const value = computeValue({ numerator, denominator, hasDenominator: payload.denominator_ids.length > 0, multiplier: payload.multiplier, decimals: payload.decimals });
  return { unidade: unit.name, mes: args.mes, formula: describeFormula(payload, names), numerador: numerator, denominador: denominator, resultado: value === null ? null : `${formatNumber(value, payload.decimals)} ${payload.result_unit}`, meta_atingida: targetStatus(value, payload.target_value, payload.target_comparison), aviso: value === null ? "Sem dados suficientes no mês para calcular." : undefined };
}));

server.registerTool("criar_indicador_qualidade", {
  title: "Criar indicador de qualidade",
  description: "Cadastra um indicador de qualidade (Interact) na unidade. O banco valida a fórmula (só contagens, sem repetição, setores da unidade) e registra auditoria.",
  inputSchema: formulaShape,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
}, wrap(async (args) => {
  const s = await ctx(); requireManager(s);
  const { unit, names, payload } = await buildPayload(s, args);
  const { data, error } = await s.supabase.from("quality_indicators").insert({ ...payload, unit_id: unit.id }).select("id,name").single();
  if (error) throw new Error(error.code === "23505" ? `Já existe um indicador chamado "${payload.name}" nesta unidade.` : error.message);
  return { criado: true, id: data.id, nome: data.name, unidade: unit.name, formula: describeFormula(payload, names) };
}));

server.registerTool("atualizar_indicador_qualidade", {
  title: "Atualizar ou desativar indicador de qualidade",
  description: "Altera nome, meta, observações, casas decimais ou ativa/desativa um indicador. Para mudar a fórmula, desative e crie outro (preserva o histórico de auditoria).",
  inputSchema: { id: z.string().uuid(), nome: z.string().min(3).max(160).optional(), codigo_interact: z.string().max(60).optional(), meta: z.number().nullable().optional(), tipo_meta: z.enum(["minimo", "maximo"]).nullable().optional(), casas_decimais: z.number().int().min(0).max(6).optional(), unidade_resultado: z.string().max(30).optional(), observacoes: z.string().max(1000).optional(), ativo: z.boolean().optional() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, wrap(async (args) => {
  const s = await ctx(); requireManager(s);
  const patch = {};
  if (args.nome !== undefined) patch.name = args.nome.trim();
  if (args.codigo_interact !== undefined) patch.interact_code = args.codigo_interact.trim() || null;
  if (args.meta !== undefined || args.tipo_meta !== undefined) {
    if ((args.meta ?? null) === null !== ((args.tipo_meta ?? null) === null)) throw new Error("Informe meta e tipo_meta juntos (ou ambos nulos para remover a meta).");
    patch.target_value = args.meta ?? null; patch.target_comparison = args.tipo_meta ?? null;
  }
  if (args.casas_decimais !== undefined) patch.decimals = args.casas_decimais;
  if (args.unidade_resultado !== undefined) patch.result_unit = args.unidade_resultado;
  if (args.observacoes !== undefined) patch.notes = args.observacoes;
  if (args.ativo !== undefined) patch.active = args.ativo;
  if (!Object.keys(patch).length) throw new Error("Nada para alterar.");
  const { data, error } = await s.supabase.from("quality_indicators").update(patch).eq("id", args.id).select("id,name,active");
  if (error) throw error;
  if (!data?.length) throw new Error("Indicador não encontrado ou sem permissão.");
  return { atualizado: true, ...data[0] };
}));

server.registerTool("calcular_indicadores_qualidade", {
  title: "Calcular indicadores de qualidade do mês",
  description: "Resultado mensal de todos os indicadores ativos da unidade (como na tela Qualidade), com mês anterior, meta e motivo quando não há dado. Pronto para lançar no portal Interact.",
  inputSchema: { unidade: z.string().optional(), mes: z.string().describe("AAAA-MM") },
  annotations: { readOnlyHint: true },
}, wrap(async ({ unidade, mes }) => {
  const s = await ctx(); requireManager(s); const unit = resolveUnit(s, unidade);
  const cur = monthRange(mes); const prev = monthRange(previousMonth(mes));
  const [inds, now, before] = await Promise.all([
    s.supabase.from("quality_indicators").select("*").eq("unit_id", unit.id).eq("active", true).order("name"),
    s.supabase.rpc("quality_indicator_results", { p_start: cur.start, p_end: cur.end, p_unit: unit.id }),
    s.supabase.rpc("quality_indicator_results", { p_start: prev.start, p_end: prev.end, p_unit: unit.id }),
  ]);
  for (const r of [inds, now, before]) if (r.error) throw r.error;
  const byId = (rows) => new Map((rows ?? []).map((r) => [r.quality_indicator_id, r]));
  const n = byId(now.data); const p = byId(before.data);
  const rows = (inds.data ?? []).map((q) => {
    const r = n.get(q.id); const value = r?.value === null || r?.value === undefined ? null : Number(r.value);
    const previous = p.get(q.id)?.value;
    return {
      indicador: q.name, codigo_interact: q.interact_code,
      resultado: value === null ? null : `${formatNumber(value, q.decimals)} ${q.result_unit}`,
      valor: value, numerador: r?.numerator === null ? null : Number(r?.numerator), denominador: r?.denominator === null || r?.denominator === undefined ? null : Number(r.denominator),
      mes_anterior: previous === null || previous === undefined ? null : `${formatNumber(previous, q.decimals)} ${q.result_unit}`,
      meta: q.target_value === null ? null : `${q.target_comparison === "maximo" ? "máx." : "mín."} ${formatNumber(q.target_value, q.decimals)} ${q.result_unit}`,
      meta_atingida: targetStatus(value, q.target_value, q.target_comparison),
      sem_dado: missingReason({ value, hasDenominator: q.denominator_ids.length > 0, numeratorRecords: Number(r?.numerator_records ?? 0), denominatorRecords: Number(r?.denominator_records ?? 0), denominator: r?.denominator }),
    };
  });
  return { unidade: unit.name, mes, periodo: `${cur.start} a ${cur.end}`, calculados: rows.filter((r) => r.valor !== null).length, total: rows.length, metas_atingidas: `${rows.filter((r) => r.meta_atingida === true).length} de ${rows.filter((r) => r.meta_atingida !== null).length}`, indicadores: rows };
}));

server.registerTool("totais_producao", {
  title: "Totais de produção do período",
  description: "Totais agregados por indicador (contagem = soma; taxa digitada = média; taxa derivada = soma/soma) para análise. Sem dados de pacientes.",
  inputSchema: { unidade: z.string().optional(), de: z.string().describe("AAAA-MM-DD"), ate: z.string().describe("AAAA-MM-DD"), servico: z.string().optional().describe("Código do serviço (opcional).") },
  annotations: { readOnlyHint: true },
}, wrap(async ({ unidade, de, ate, servico }) => {
  const s = await ctx(); const unit = resolveUnit(s, unidade);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) throw new Error("Período inválido: use AAAA-MM-DD e de <= ate.");
  const serviceId = servico ? (await servicesByCode(s)).get(servico)?.id : null;
  if (servico && !serviceId) throw new Error(`Serviço "${servico}" não existe.`);
  const { data, error } = await s.supabase.rpc("production_metrics_totals", { p_start: de, p_end: ate, p_unit: unit.id, p_service: serviceId, p_sector: null });
  if (error) throw error;
  return { unidade: unit.name, de, ate, indicadores: (data ?? []).filter((r) => r.total !== null).map((r) => ({ codigo: r.indicator_code, nome: r.indicator_name, tipo: r.kind, derivado: r.derived, total: Number(r.total) })) };
}));

await server.connect(new StdioServerTransport());
