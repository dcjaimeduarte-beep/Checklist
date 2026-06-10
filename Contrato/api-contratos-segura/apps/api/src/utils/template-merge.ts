// Converte número para extenso em português (simplificado para valores de contratos)
function numToExtenso(value: number): string {
  if (value === 0) return "zero reais";

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos",
    "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function grupo(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";
    const c = Math.floor(n / 100);
    const resto = n % 100;
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    let s = "";
    if (c > 0) s += centenas[c];
    if (c > 0 && resto > 0) s += " e ";
    if (resto > 0) {
      if (resto < 20) s += unidades[resto];
      else {
        s += dezenas[d];
        if (u > 0) s += " e " + unidades[u];
      }
    }
    return s;
  }

  const reais = Math.floor(value);
  const centavos = Math.round((value - reais) * 100);

  let texto = "";
  if (reais >= 1000) {
    const mil = Math.floor(reais / 1000);
    const resto = reais % 1000;
    texto += grupo(mil) + " mil";
    if (resto > 0) texto += " e " + grupo(resto);
  } else {
    texto = grupo(reais);
  }

  texto += reais === 1 ? " real" : " reais";

  if (centavos > 0) {
    texto += " e " + grupo(centavos) + (centavos === 1 ? " centavo" : " centavos");
  }

  // Capitalizar primeira letra
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function fmtDate(iso: string | Date): string {
  const d = new Date(iso);
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function fmtMesAno(iso: string | Date): string {
  const d = new Date(iso);
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function fmtCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type MergeContext = {
  client: {
    razaoSocial: string;
    cnpj?: string | null;
    email?: string | null;
    phone?: string | null;
    contactName?: string | null;
    street?: string | null;
    addressNumber?: string | null;
    addressComplement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  };
  contract: {
    identifier?: string | null;
    startDate: Date;
    firstPaymentDate?: Date | null;
    durationMonths: number;
    implementationFee: number;
    implementationPayment: string;
    monthlyFee: number;
    discount?: number;
    paymentDayOfMonth: number;
    adjustmentIndex: string;
    moduleCadastros: boolean;
    moduleFaturamento: boolean;
    moduleFiscal: boolean;
    signedAt?: Date | null;
    signedByName?: string | null;
    distanceFromProviderKm?: number | null;
    adjustmentRate?: number | null;
    notes?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
  };
};

export function applyClauseOverrides(content: string, overridesJson: string | null | undefined): string {
  if (!overridesJson) return content;
  let overrides: Record<string, string>;
  try { overrides = JSON.parse(overridesJson); } catch { return content; }

  // Ordena do maior para menor para evitar que "1" substitua dentro de "10", "16", etc.
  const sorted = Object.entries(overrides).sort((a, b) => Number(b[0]) - Number(a[0]));

  let result = content;
  for (const [clauseNum, newText] of sorted) {
    if (!newText?.trim()) continue;
    // Captura o cabeçalho (ex: "Cláusula 1ª:\n") no grupo 1 e substitui só o corpo
    // (?!\d) evita que "1" case com "10", "16" etc.
    const regex = new RegExp(
      `(Cl[aá]usula\\s+${clauseNum}(?!\\d)[^\\n]*\\n)[\\s\\S]*?(?=Cl[aá]usula\\s+\\d|---ASSINATURA---|$)`,
      'i'
    );
    if (regex.test(result)) {
      result = result.replace(regex, '$1' + newText.trimEnd() + '\n\n');
    }
  }
  return result;
}

export function mergeTemplate(templateContent: string, ctx: MergeContext): string {
  const { client, contract } = ctx;
  const discount = contract.discount ?? 0;
  const effectiveMonthly = Math.max(0, contract.monthlyFee - discount);

  // Endereço completo do contratante
  const enderecoParts = [
    client.street,
    client.addressNumber ? `nº ${client.addressNumber}` : null,
    client.addressComplement,
  ].filter(Boolean);
  const enderecoCompleto = enderecoParts.join(", ") || "—";

  const cidadeUf = [client.city, client.state].filter(Boolean).join("/") || "—";

  // Módulos contratados
  const modulos = [
    contract.moduleCadastros ? "Cadastros" : null,
    contract.moduleFaturamento ? "Faturamento" : null,
    contract.moduleFiscal ? "Fiscal" : null,
  ].filter(Boolean).join(" | ") || "—";

  // Forma de pagamento da implantação
  const formaImplantacao = contract.implementationPayment === "avista" ? "à vista" :
    contract.implementationPayment === "parcelado" ? "parcelado" : contract.implementationPayment;

  // Prazo em anos/meses
  const prazoAnos = contract.durationMonths === 12 ? "1 (Um) ano" :
    contract.durationMonths === 24 ? "2 (Dois) anos" :
    `${contract.durationMonths} (${numToExtenso(contract.durationMonths).split(" ")[0]}) meses`;

  const dataAssinatura = contract.signedAt
    ? fmtDate(contract.signedAt)
    : fmtDate(new Date());

  const horaAssinatura = contract.signedAt
    ? new Date(contract.signedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  const vars: Record<string, string> = {
    // Contratante (cliente)
    "{{CONTRATANTE_RAZAO_SOCIAL}}":    client.razaoSocial,
    "{{CONTRATANTE_CNPJ}}":            client.cnpj ?? "—",
    "{{CONTRATANTE_EMAIL}}":           client.email ?? "—",
    "{{CONTRATANTE_TELEFONE}}":        client.phone ?? "",
    "{{CONTRATANTE_CONTATO}}":         contract.contactName ?? client.contactName ?? "—",
    "{{CONTRATANTE_CELULAR}}":         contract.contactPhone ?? client.phone ?? "—",
    "{{CONTRATANTE_ENDERECO}}":        enderecoCompleto,
    "{{CONTRATANTE_BAIRRO}}":          client.neighborhood ?? "—",
    "{{CONTRATANTE_CIDADE_UF}}":       cidadeUf,
    "{{CONTRATANTE_CEP}}":             client.zipCode ?? "—",

    // Contrato
    "{{NUMERO_CONTRATO}}":             contract.identifier ?? "—",
    "{{MODULOS}}":                     modulos,
    "{{VALOR_IMPLANTACAO}}":           `R$ ${fmtCurrency(contract.implementationFee)}`,
    "{{VALOR_IMPLANTACAO_EXTENSO}}":   numToExtenso(contract.implementationFee),
    "{{FORMA_PAGAMENTO_IMPLANTACAO}}": formaImplantacao,
    "{{VALOR_MENSALIDADE}}":           `R$ ${fmtCurrency(effectiveMonthly)}`,
    "{{VALOR_MENSALIDADE_EXTENSO}}":   numToExtenso(effectiveMonthly),
    "{{VALOR_DESCONTO}}":              discount > 0 ? `R$ ${fmtCurrency(discount)}` : "—",
    "{{VALOR_MENSALIDADE_ORIGINAL}}":  `R$ ${fmtCurrency(contract.monthlyFee)}`,
    "{{MES_INICIO_PAGAMENTO}}":        contract.firstPaymentDate ? fmtMesAno(contract.firstPaymentDate) : fmtMesAno(contract.startDate),
    "{{DIA_VENCIMENTO}}":              String(contract.paymentDayOfMonth),
    "{{PRAZO}}":                       prazoAnos,
    "{{MES_INICIO_CONTRATO}}":         fmtMesAno(contract.startDate),
    "{{INDICE_REAJUSTE}}":             contract.adjustmentIndex,
    "{{TAXA_REAJUSTE}}":               contract.adjustmentRate != null ? `${contract.adjustmentRate}%` : "a ser definido",
    "{{DATA_ASSINATURA}}":             dataAssinatura,
    "{{HORA_ASSINATURA}}":             horaAssinatura,
    "{{NOME_ASSINANTE}}":              contract.signedByName ?? "",
    "{{DISTANCIA_KM}}":                contract.distanceFromProviderKm ? String(contract.distanceFromProviderKm) : "—",
  };

  // Blocos condicionais: {{#SE_IMPLANTACAO}}...{{/SE_IMPLANTACAO}}
  const condBlocks: { tag: string; show: boolean }[] = [
    { tag: "SE_IMPLANTACAO",  show: contract.implementationFee > 0 },
    { tag: "SE_DESCONTO",     show: (contract.discount ?? 0) > 0 },
    { tag: "SE_DISTANCIA",    show: !!contract.distanceFromProviderKm },
    { tag: "SE_OBSERVACOES",  show: !!contract.notes },
    { tag: "SE_ASSINADO",     show: !!contract.signedAt && !!contract.signedByName },
    { tag: "SE_NAO_ASSINADO", show: !contract.signedAt || !contract.signedByName },
  ];

  let result = templateContent;

  // Processa blocos condicionais antes das variáveis
  for (const { tag, show } of condBlocks) {
    const re = new RegExp(`\\{\\{#${tag}\\}\\}([\\s\\S]*?)\\{\\{/${tag}\\}\\}`, "g");
    result = result.replace(re, show ? "$1" : "");
  }

  for (const [placeholder, value] of Object.entries(vars)) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
}
