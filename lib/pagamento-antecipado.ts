import { meses } from "@/lib/formatadores";

export type TipoDescontoAntecipado = "Sem desconto" | "Percentual" | "Valor fixo";

export type CompetenciaAntecipada = {
  mes: number;
  ano: number;
  rotulo: string;
  vencimento: string;
  valorOriginal: number;
  desconto: number;
  valorFinal: number;
};

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

export function competenciasAntecipadas(mesInicial: number, anoInicial: number, quantidade: number, valorMensal: number, tipoDesconto: TipoDescontoAntecipado, desconto: number, diaVencimento = 8): CompetenciaAntecipada[] {
  const quantidadeSegura = Math.max(1, Math.min(24, Math.trunc(quantidade)));
  const totalOriginalCentavos = Math.round(valorMensal * 100) * quantidadeSegura;
  const descontoTotalCentavos = tipoDesconto === "Percentual"
    ? Math.min(totalOriginalCentavos, Math.round(totalOriginalCentavos * Math.max(0, desconto) / 100))
    : tipoDesconto === "Valor fixo"
      ? Math.min(totalOriginalCentavos, Math.round(Math.max(0, desconto) * 100))
      : 0;
  const base = Math.floor(descontoTotalCentavos / quantidadeSegura);
  let resto = descontoTotalCentavos % quantidadeSegura;
  return Array.from({ length: quantidadeSegura }, (_, indice) => {
    const data = new Date(anoInicial, mesInicial - 1 + indice, 1);
    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();
    const descontoCentavos = base + (resto-- > 0 ? 1 : 0);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    return {
      mes, ano,
      rotulo: `${meses[mes - 1]}/${ano}`,
      vencimento: `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(diaVencimento, ultimoDia)).padStart(2, "0")}`,
      valorOriginal: arredondar(valorMensal),
      desconto: descontoCentavos / 100,
      valorFinal: (Math.round(valorMensal * 100) - descontoCentavos) / 100
    };
  });
}
