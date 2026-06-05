import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEMPLATE_CONTENT = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS {{NUMERO_CONTRATO}}

Contrato de Sistema de Gestão que celebram BARBOSA E ALMEIDA TECNOLOGIA LTDA - EPP e {{CONTRATANTE_RAZAO_SOCIAL}}

CONTRATENTES

Contratante
{{CONTRATANTE_RAZAO_SOCIAL}}
{{CONTRATANTE_ENDERECO}}
Bairro: {{CONTRATANTE_BAIRRO}}
{{CONTRATANTE_CIDADE_UF}} CEP: {{CONTRATANTE_CEP}}
CNPJ: {{CONTRATANTE_CNPJ}}
E-mail: {{CONTRATANTE_EMAIL}}
{{CONTRATANTE_TELEFONE}}
Contato: {{CONTRATANTE_CONTATO}}

Contratada
BARBOSA E ALMEIDA TECNOLOGIA LTDA - EPP
Rua Major Vicente Sabino nº 357 Farol – Centro Empresarial Espaço 357, Sala 101
Maceió/AL CEP: 57052-485
CNPJ: 22.510.733/0001-09
Telefone: (82) 3027-7128
Neste ato, representada por José Edson Almeida da Silva

As partes acima identificadas têm, entre si, justas e acertadas o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descrito no presente.

DO OBJETO DO CONTRATO
Cláusula 1ª:
Sistema de gestão compreendendo os módulos abaixo:
Sistema de Gestão ({{MODULOS}})

OBRIGAÇÕES DO CONTRATENTE
Cláusula 2ª:
Vale ressaltar que a veracidade dos dados enviados é de inteira responsabilidade da contratante, tendo a mesma obrigatoriedade de garantir tais veracidades e integridade dos dados cadastrados no sistema de gestão utilizado na empresa.

Cláusula 3ª:
O CONTRATANTE deverá efetuar o pagamento na forma e condições estabelecidas na cláusula 6ª.

OBRIGAÇÕES DO CONTRATADO
Cláusula 4ª:
É dever de o CONTRATADO oferecer ao contratante a cópia do presente instrumento, contendo todas as especificidades da prestação de serviço contratado.

DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO
Cláusula 5ª:
O presente serviço será remunerado:
Pela quantia de {{VALOR_IMPLANTACAO}} ({{VALOR_IMPLANTACAO_EXTENSO}}) referente à implantação e treinamento, sendo pago {{FORMA_PAGAMENTO_IMPLANTACAO}}.
Pela quantia de {{VALOR_MENSALIDADE}} ({{VALOR_MENSALIDADE_EXTENSO}}) referente aos serviços prestados/suporte, devendo ser pago no boleto, ou outra forma de pagamento em que ocorra a prévia concordância de ambas as partes, a contar a primeira parcela a partir do mês de {{MES_INICIO_PAGAMENTO}}. Vencimento {{DIA_VENCIMENTO}}

DA DURAÇÃO
Cláusula 6ª:
O presente instrumento tem um prazo de duração de {{PRAZO}} a partir da competência de {{MES_INICIO_CONTRATO}}, sem prorrogação prévia.

DO REAJUSTE
Cláusula 7ª:
Os valores ora pactuados serão corrigidos, de forma anual, pelo {{INDICE_REAJUSTE}} ou outro indexador que venha a substituí-lo. A correção supracitada dar-se-á depois de transcorridos 12 (doze) meses contados do término da carência concedida, isto é, no ato da renovação contratual.

DO INADIMPLEMENTO, DO DESCUMPRIMENTO E DA MULTA
Cláusula 8ª:
Em caso de inadimplemento por parte do CONTRATANTE quanto ao pagamento do serviço prestado, deverá incidir sobre o valor do presente instrumento, multa pecuniária de 2%, juros de mora de 1% ao mês e correção monetária. Parágrafo único. Em caso de cobrança judicial, devem ser acrescidas custas processuais e 20% de honorários advocatícios.

Cláusula 9ª:
No caso de não haver o cumprimento de qualquer uma das cláusulas, exceto a 5ª, do presente instrumento, a parte que não cumpriu deverá pagar uma multa de 10% do valor do contrato para a outra parte.

DA RESCISÃO IMOTIVADA
Cláusula 10ª:
Poderá o presente instrumento ser rescindido por qualquer uma das partes, em qualquer momento, sem que haja qualquer tipo de motivo relevante, não obstante a outra parte deverá ser avisada previamente por escrito, no prazo de 30 dias.

Cláusula 11ª:
Caso o CONTRATANTE já tenha realizado o pagamento pelo serviço, e mesmo assim, requisite a rescisão imotivada do presente contrato, terá o valor da quantia paga devolvido, deduzindo-se 2% de taxas administrativas.

Cláusula 12ª:
Caso seja o CONTRATADO quem requeira a rescisão imotivada, deverá devolver a quantia que se refere aos serviços por ele não prestados ao CONTRATANTE, acrescentado de 2% de taxas administrativas.

DO PRAZO
Cláusula 13ª:
O CONTRATADO assume o compromisso de realizar o serviço dentro do prazo de até o 5º dia após o recebimento dos arquivos, caso a cláusula 2ª seja obedecida. Caso contrário deverá ser acrescido à diferença de dias no prazo de entrega.

DAS CONDIÇÕES GERAIS
Cláusula 14ª:
Fica compactuado entre as partes a total inexistência de vínculo trabalhista entre as partes contratantes, excluindo as obrigações previdenciárias e os encargos sociais, não havendo entre CONTRATADO e CONTRATANTE qualquer tipo de relação de subordinação.

Cláusula 15ª:
Salvo com a expressa autorização do CONTRATANTE, não pode o CONTRATADO transferir ou subcontratar os serviços previstos neste instrumento, sob o risco de ocorrer a rescisão imediata.

Cláusula 16ª:
O valor acima descrito é a forma de pagamento pela integração mensal das seguintes empresas:
CNPJ: {{CONTRATANTE_CNPJ}}
{{CONTRATANTE_RAZAO_SOCIAL}}

SUPORTE TÉCNICO
Cláusula 17ª:
Todo e quaisquer suporte é feito através da conexão remota, sendo que, se necessário a visita técnica do colaborador ao estabelecimento dentro da capital.
Clientes com distâncias superior a 30 km, da sede da Seven Sistemas de Automação, será cobrado a despesa de locomoção com veículo, considerando-se a multiplicação de 35% (trinta e cinco por cento) do valor de um litro de gasolina automotiva pela quantidade de quilômetros utilizados para percorrer a distância entre a Seven e as instalações do cliente, + despesas com hospedagem, alimentação e transporte (se necessário).

DO FORO
Cláusula 18ª:
Fica eleito o foro da Cidade de Maceió, Estado de Alagoas, para as demandas decorrentes deste presente instrumento, com expressa renúncia à qualquer outro, por mais privilegiado que seja.

E, por estarem justos e contratados, firmam o presente documento, em duas vias de igual teor, na presença das testemunhas abaixo.

---ASSINATURA---
{{DATA_ASSINATURA}}
BARBOSA E ALMEIDA TECNOLOGIA LTDA – EPP
{{CONTRATANTE_RAZAO_SOCIAL}}`;

async function main() {
  // Atualiza todos os templates existentes com isDefault=true, ou cria um novo
  const existing = await prisma.contractTemplate.findFirst({ where: { isDefault: true } });

  if (existing) {
    await prisma.contractTemplate.update({
      where: { id: existing.id },
      data: {
        name: "Contrato Padrão Seven — Prestação de Serviços",
        content: TEMPLATE_CONTENT,
        isDefault: true,
      },
    });
    console.log("✓ Template padrão atualizado com o texto completo.");
  } else {
    await prisma.contractTemplate.create({
      data: {
        name: "Contrato Padrão Seven — Prestação de Serviços",
        content: TEMPLATE_CONTENT,
        isDefault: true,
      },
    });
    console.log("✓ Template padrão criado com sucesso.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
