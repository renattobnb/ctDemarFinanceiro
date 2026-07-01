"use client";

import { Home, Plus, Share, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PlataformaInstalacao = "android" | "ios" | "desktop" | "desconhecida";

const chaveInstalado = "ctdemar_install_app_installed";
const chaveNaoMostrar = "ctdemar_install_app_never_show";
const chaveOcultarAte = "ctdemar_install_app_hide_until";
const diasOcultarTemporariamente = 3;

export function estaEmModoInstalado() {
  if (typeof window === "undefined") return false;

  const navegadorStandalone = "standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return window.matchMedia("(display-mode: standalone)").matches || navegadorStandalone;
}

function detectarPlataforma(): PlataformaInstalacao {
  if (typeof window === "undefined") return "desconhecida";

  const agente = window.navigator.userAgent.toLowerCase();
  const dispositivoApple = /iphone|ipad|ipod/.test(agente);
  const dispositivoAndroid = /android/.test(agente);
  const mobile = dispositivoApple || dispositivoAndroid || window.navigator.maxTouchPoints > 1;

  if (dispositivoApple) return "ios";
  if (dispositivoAndroid) return "android";
  if (!mobile) return "desktop";
  return "desconhecida";
}

function obterBooleano(chave: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(chave) === "true";
}

function deveOcultarTemporariamente() {
  if (typeof window === "undefined") return false;

  const timestamp = Number(window.localStorage.getItem(chaveOcultarAte) ?? 0);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function ocultarTemporariamente() {
  const ate = Date.now() + diasOcultarTemporariamente * 24 * 60 * 60 * 1000;
  window.localStorage.setItem(chaveOcultarAte, String(ate));
}

export function useInstallPrompt() {
  const [promptInstalacao, definirPromptInstalacao] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalado, definirInstalado] = useState(false);
  const [naoMostrar, definirNaoMostrar] = useState(false);
  const [ocultoTemporariamente, definirOcultoTemporariamente] = useState(false);
  const [modalAberto, definirModalAberto] = useState(false);
  const [mensagem, definirMensagem] = useState("");
  const [plataforma, definirPlataforma] = useState<PlataformaInstalacao>("desconhecida");

  useEffect(() => {
    definirInstalado(estaEmModoInstalado() || obterBooleano(chaveInstalado));
    definirNaoMostrar(obterBooleano(chaveNaoMostrar));
    definirOcultoTemporariamente(deveOcultarTemporariamente());
    definirPlataforma(detectarPlataforma());

    function capturarPrompt(evento: Event) {
      evento.preventDefault();
      definirPromptInstalacao(evento as BeforeInstallPromptEvent);
    }

    function aoInstalar() {
      window.localStorage.setItem(chaveInstalado, "true");
      definirInstalado(true);
      definirMensagem("App instalado com sucesso!");
      definirPromptInstalacao(null);
      definirModalAberto(false);
    }

    window.addEventListener("beforeinstallprompt", capturarPrompt);
    window.addEventListener("appinstalled", aoInstalar);

    return () => {
      window.removeEventListener("beforeinstallprompt", capturarPrompt);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  const exibirBanner = useMemo(() => {
    return !instalado && !naoMostrar && !ocultoTemporariamente && plataforma !== "desktop";
  }, [instalado, naoMostrar, ocultoTemporariamente, plataforma]);

  async function instalarApp() {
    if (instalado) return;

    if (promptInstalacao && plataforma !== "ios") {
      await promptInstalacao.prompt();
      const escolha = await promptInstalacao.userChoice;
      definirPromptInstalacao(null);

      if (escolha.outcome === "accepted") {
        window.localStorage.setItem(chaveInstalado, "true");
        definirInstalado(true);
        definirMensagem("App instalado com sucesso!");
      } else {
        ocultarTemporariamente();
        definirOcultoTemporariamente(true);
      }

      return;
    }

    definirModalAberto(true);
  }

  function ocultarAgora() {
    ocultarTemporariamente();
    definirOcultoTemporariamente(true);
  }

  function naoMostrarNovamente() {
    window.localStorage.setItem(chaveNaoMostrar, "true");
    definirNaoMostrar(true);
    definirModalAberto(false);
  }

  function abrirAjuda() {
    definirModalAberto(true);
  }

  return {
    abrirAjuda,
    exibirBanner,
    instalado,
    instalarApp,
    mensagem,
    modalAberto,
    naoMostrarNovamente,
    ocultarAgora,
    plataforma,
    setModalAberto: definirModalAberto
  };
}

function InstrucoesInstalacao({ plataforma }: { plataforma: PlataformaInstalacao }) {
  if (plataforma === "android") {
    return (
      <ol className="space-y-2 text-sm text-slate-700">
        <li className="flex gap-3">
          <Passo numero="1" />
          Toque em <strong>Instalar app</strong>. Se aparecer uma janela do navegador, confirme a instalacao.
        </li>
        <li className="flex gap-3">
          <Passo numero="2" />
          Se a janela nao aparecer, abra o menu do Chrome e escolha <strong>Adicionar a tela inicial</strong>.
        </li>
        <li className="flex gap-3">
          <Passo numero="3" />
          Confirme em <strong>Adicionar</strong>.
        </li>
      </ol>
    );
  }

  if (plataforma === "ios") {
    return (
      <ol className="space-y-2 text-sm text-slate-700">
        <li className="flex gap-3">
          <Passo numero="1" />
          Abra o sistema no Safari.
        </li>
        <li className="flex gap-3">
          <Passo numero="2" />
          Toque no botao de compartilhar do Safari.
        </li>
        <li className="flex gap-3">
          <Passo numero="3" />
          Escolha <strong>Adicionar a Tela de Inicio</strong> e confirme em <strong>Adicionar</strong>.
        </li>
      </ol>
    );
  }

  return (
    <ol className="space-y-2 text-sm text-slate-700">
      <li className="flex gap-3">
        <Passo numero="1" />
        No celular, abra este sistema pelo navegador.
      </li>
      <li className="flex gap-3">
        <Passo numero="2" />
        Use a opcao do navegador para adicionar o app a tela inicial.
      </li>
      <li className="flex gap-3">
        <Passo numero="3" />
        Confirme para abrir o CTDEMAR como aplicativo.
      </li>
    </ol>
  );
}

function Passo({ numero }: { numero: string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-extrabold text-destaque">
      {numero}
    </span>
  );
}

export function InstallAppBanner({ controle }: { controle: ReturnType<typeof useInstallPrompt> }) {
  if (!controle.exibirBanner) return null;

  return (
    <div className="surface-card flex items-start gap-3 border-teal-100 bg-teal-50/80 p-3 sm:hidden">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-destaque">
        <Smartphone className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-slate-950">Instale o CTDEMAR no seu celular para acessar mais rapido.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={controle.instalarApp}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-destaque px-3 py-1.5 text-xs font-extrabold text-white shadow-sm active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            Instalar app
          </button>
          <button
            type="button"
            onClick={controle.ocultarAgora}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-teal-100 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 active:scale-95"
          >
            Agora nao
          </button>
        </div>
      </div>
    </div>
  );
}

export function InstallAppHelpButton({ controle }: { controle: ReturnType<typeof useInstallPrompt> }) {
  if (controle.instalado) return null;

  return (
    <button
      type="button"
      onClick={controle.abrirAjuda}
      className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-teal-100 bg-white/85 px-3 py-1.5 text-xs font-extrabold text-destaque shadow-sm active:scale-[0.99] sm:w-auto"
    >
      <Home className="h-4 w-4" />
      Como instalar o app
    </button>
  );
}

export function InstallAppModal({ controle }: { controle: ReturnType<typeof useInstallPrompt> }) {
  if (!controle.modalAberto) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 px-3 pb-3 pt-10 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-destaque">Instalar no celular</p>
            <h2 className="text-lg font-black text-slate-950">Como instalar o app</h2>
          </div>
          <button
            type="button"
            onClick={() => controle.setModalAberto(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/10 text-slate-600"
            aria-label="Fechar instrucoes"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="my-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-teal-50 p-3 text-center text-destaque">
            <Share className="mx-auto h-5 w-5" />
            <p className="mt-1 text-[0.65rem] font-bold uppercase">Compartilhar</p>
          </div>
          <div className="rounded-xl bg-teal-50 p-3 text-center text-destaque">
            <Plus className="mx-auto h-5 w-5" />
            <p className="mt-1 text-[0.65rem] font-bold uppercase">Adicionar</p>
          </div>
          <div className="rounded-xl bg-teal-50 p-3 text-center text-destaque">
            <Home className="mx-auto h-5 w-5" />
            <p className="mt-1 text-[0.65rem] font-bold uppercase">Tela inicial</p>
          </div>
        </div>

        <InstrucoesInstalacao plataforma={controle.plataforma} />

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={() => controle.setModalAberto(false)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-destaque px-4 py-2 text-sm font-extrabold text-white"
          >
            Entendi
          </button>
          <button
            type="button"
            onClick={controle.naoMostrarNovamente}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-bold text-slate-700"
          >
            Nao mostrar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
