export const meses = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

export function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valor || 0);
}

export function formatarData(data: string | null) {
  if (!data) return "-";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function dataAtualIso() {
  return new Date().toISOString().slice(0, 10);
}

export function mesAtual() {
  return new Date().getMonth() + 1;
}

export function anoAtual() {
  return new Date().getFullYear();
}

export function numeroWhatsapp(telefone: string | null) {
  return (telefone ?? "").replace(/\D/g, "");
}
