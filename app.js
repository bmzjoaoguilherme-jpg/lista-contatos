const CHAVE_PERFIS = "perfis";
const CHAVE_ATUAL = "perfilAtual";
const SUFIXO_EXCLUIDOS = ":excluidos";

// posição 0 = ainda não ligou, 1 = já fez a 1ª ligação, e assim por diante
const ROTULOS = ["Pendentes", "1ª ligação", "2ª ligação", "3ª ligação", "4ª ligação"];
const ULTIMA_ETAPA = ROTULOS.length - 1;

let perfis = carregar(CHAVE_PERFIS, []);
let perfilAtual = carregar(CHAVE_ATUAL, "");
let contatos = [];
let excluidos = [];
let filtro = "0";

const $ = (id) => document.getElementById(id);

// ---------- armazenamento ----------

function carregar(chave, padrao) {
  try {
    const salvo = localStorage.getItem(chave);
    return salvo ? JSON.parse(salvo) : padrao;
  } catch (erro) {
    return padrao;
  }
}

function guardar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (erro) {
    // sem localStorage (modo privado, por exemplo), segue sem salvar
  }
}

// cada perfil tem a sua própria lista guardada
function chaveDados(nome) {
  return "dados:" + nome;
}

function salvar() {
  guardar(chaveDados(perfilAtual), contatos);
  guardar(chaveDados(perfilAtual) + SUFIXO_EXCLUIDOS, excluidos);
}

// ---------- perfis ----------

function preencherPerfis() {
  const select = $("selPerfil");
  select.innerHTML = "";
  perfis.forEach((nome) => {
    const opcao = document.createElement("option");
    opcao.value = nome;
    opcao.textContent = nome;
    select.appendChild(opcao);
  });
  select.value = perfilAtual;
}

function abrirPerfil(nome) {
  perfilAtual = nome;
  guardar(CHAVE_ATUAL, perfilAtual);
  contatos = carregar(chaveDados(perfilAtual), []);
  excluidos = carregar(chaveDados(perfilAtual) + SUFIXO_EXCLUIDOS, []);
  preencherPerfis();
  mudarFiltro("0");
}

function iniciarPerfis() {
  if (!perfis.length) {
    const nome = (prompt("Qual é o seu nome?") || "").trim() || "Meu perfil";
    perfis = [nome];
    guardar(CHAVE_PERFIS, perfis);
    perfilAtual = nome;
  }
  if (!perfis.includes(perfilAtual)) perfilAtual = perfis[0];
  abrirPerfil(perfilAtual);
}

function novoPerfil() {
  const nome = (prompt("Nome do novo perfil:") || "").trim();
  if (!nome) return;

  if (!perfis.includes(nome)) {
    perfis.push(nome);
    guardar(CHAVE_PERFIS, perfis);
  }
  abrirPerfil(nome);
}

function excluirPerfil() {
  if (perfis.length === 1) {
    avisar("Precisa existir pelo menos um perfil");
    return;
  }
  if (!confirm(`Apagar o perfil "${perfilAtual}" e todos os contatos dele?`)) return;

  try {
    localStorage.removeItem(chaveDados(perfilAtual));
    localStorage.removeItem(chaveDados(perfilAtual) + SUFIXO_EXCLUIDOS);
  } catch (erro) {
    // ignora
  }
  perfis = perfis.filter((nome) => nome !== perfilAtual);
  guardar(CHAVE_PERFIS, perfis);
  abrirPerfil(perfis[0]);
}

// ---------- avisos e cópia ----------

function avisar(mensagem, tempo = 1500) {
  const aviso = $("aviso");
  aviso.textContent = mensagem;
  aviso.classList.add("visivel");
  clearTimeout(avisar.timer);
  avisar.timer = setTimeout(() => aviso.classList.remove("visivel"), tempo);
}

function copiar(texto) {
  const deuCerto = () => avisar("Copiado: " + texto);

  const copiarAntigo = () => {
    const campo = document.createElement("textarea");
    campo.value = texto;
    document.body.appendChild(campo);
    campo.select();
    try {
      document.execCommand("copy");
      deuCerto();
    } catch (erro) {
      avisar("Não consegui copiar");
    }
    campo.remove();
  };

  if (navigator.clipboard) {
    navigator.clipboard.writeText(texto).then(deuCerto, copiarAntigo);
  } else {
    copiarAntigo();
  }
}

// tira o 55 (ou o que estiver no campo) do começo do número
function formatarNumero(numero) {
  const prefixo = $("prefixo").value.trim();
  if (prefixo && numero.startsWith(prefixo)) {
    return numero.slice(prefixo.length);
  }
  return numero;
}

// ---------- ligações ----------

function registrarLigacao(contato) {
  if (contato.etapa >= ULTIMA_ETAPA) return;
  contato.etapa++;
  contato.ultima = Date.now();
  salvar();
  desenhar();
  avisar("Movido para " + ROTULOS[contato.etapa]);
}

function voltarEtapa(contato) {
  if (contato.etapa <= 0) return;
  contato.etapa--;
  if (contato.etapa === 0) contato.ultima = null;
  salvar();
  desenhar();
  avisar("Voltou para " + ROTULOS[contato.etapa]);
}

function formatarData(timestamp) {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function excluirContato(contato) {
  if (!confirm(`Mover "${contato.nome}" para Excluídos?`)) return;
  contatos = contatos.filter((c) => c !== contato);
  excluidos.unshift({ ...contato, excluidoEm: Date.now() });
  salvar();
  desenhar();
  avisar("Contato movido para Excluídos");
}

function restaurarContato(contato) {
  excluidos = excluidos.filter((c) => c !== contato);
  const { excluidoEm, ...restaurado } = contato;
  contatos.unshift(restaurado);
  salvar();
  desenhar();
  avisar("Contato restaurado");
}

function excluirPermanentemente(contato) {
  if (!confirm(`Excluir "${contato.nome}" permanentemente? Esta ação não pode ser desfeita.`)) return;
  excluidos = excluidos.filter((c) => c !== contato);
  salvar();
  desenhar();
  avisar("Contato excluído permanentemente");
}

// ---------- tela ----------

function atualizarAbas() {
  document.querySelectorAll(".abas button").forEach((botao) => {
    const f = botao.dataset.filtro;
    if (f === "todos") {
      botao.textContent = `Todos (${contatos.length})`;
    } else if (f === "excluidos") {
      botao.textContent = `Excluídos (${excluidos.length})`;
    } else {
      const quantos = contatos.filter((c) => c.etapa === Number(f)).length;
      botao.textContent = `${ROTULOS[f]} (${quantos})`;
    }
  });
}

function desenhar() {
  const busca = $("busca").value.toLowerCase();
  const tabela = $("tabela");
  tabela.innerHTML = "";
  let mostrados = 0;
  const vendoExcluidos = filtro === "excluidos";
  const lista = vendoExcluidos ? excluidos : contatos;

  lista.forEach((contato) => {
    if (!vendoExcluidos && filtro !== "todos" && String(contato.etapa) !== filtro) return;
    if (busca && !contato.nome.toLowerCase().includes(busca) && !contato.numero.includes(busca)) return;

    mostrados++;
    const linha = document.createElement("tr");

    const celulaNome = document.createElement("td");
    celulaNome.className = "nome";
    celulaNome.textContent = contato.nome;
    if (contato.ultima) {
      const data = document.createElement("small");
      data.textContent = "Última ligação: " + formatarData(contato.ultima);
      celulaNome.appendChild(data);
    }
    if (vendoExcluidos && contato.excluidoEm) {
      const dataExclusao = document.createElement("small");
      dataExclusao.textContent = "Excluído: " + formatarData(contato.excluidoEm);
      celulaNome.appendChild(dataExclusao);
    }

    const celulaNumero = document.createElement("td");
    celulaNumero.className = "numero";
    const numero = document.createElement("span");
    numero.className = "numero-texto";
    numero.textContent = formatarNumero(contato.numero);
    numero.title = "Clique para copiar o número";
    numero.addEventListener("click", () => {
      copiar(formatarNumero(contato.numero));
      numero.classList.add("copiado");
      setTimeout(() => numero.classList.remove("copiado"), 500);
    });
    celulaNumero.appendChild(numero);

    if (!vendoExcluidos) {
      const lixeira = document.createElement("button");
      lixeira.className = "btn btn-lixeira";
      lixeira.type = "button";
      lixeira.textContent = "🗑";
      lixeira.title = "Mover para Excluídos";
      lixeira.setAttribute("aria-label", `Mover ${contato.nome} para Excluídos`);
      lixeira.addEventListener("click", (evento) => {
        evento.stopPropagation();
        excluirContato(contato);
      });
      celulaNumero.appendChild(lixeira);
    }

    const celulaBotoes = document.createElement("td");
    celulaBotoes.className = "botoes";

    if (vendoExcluidos) {
      const restaurar = document.createElement("button");
      restaurar.className = "btn";
      restaurar.textContent = "↩ Restaurar";
      restaurar.title = "Restaurar contato";
      restaurar.addEventListener("click", () => restaurarContato(contato));
      celulaBotoes.appendChild(restaurar);

      const apagar = document.createElement("button");
      apagar.className = "btn btn-apagar-definitivo";
      apagar.textContent = "Excluir de vez";
      apagar.title = "Excluir permanentemente";
      apagar.addEventListener("click", () => excluirPermanentemente(contato));
      celulaBotoes.appendChild(apagar);
    } else {
      if (contato.etapa < ULTIMA_ETAPA) {
        const avancar = document.createElement("button");
        avancar.className = "btn";
        avancar.textContent = `Liguei (${contato.etapa + 1}ª)`;
        avancar.addEventListener("click", () => registrarLigacao(contato));
        celulaBotoes.appendChild(avancar);
      } else {
        const fim = document.createElement("span");
        fim.className = "concluido";
        fim.textContent = "4 ligações feitas";
        celulaBotoes.appendChild(fim);
      }

      if (contato.etapa > 0) {
        const voltar = document.createElement("button");
        voltar.className = "btn";
        voltar.textContent = "↩";
        voltar.title = "Voltar uma etapa";
        voltar.addEventListener("click", () => voltarEtapa(contato));
        celulaBotoes.appendChild(voltar);
      }
    }

    linha.append(celulaNome, celulaNumero, celulaBotoes);
    tabela.appendChild(linha);
  });

  atualizarAbas();
  $("contador").textContent = vendoExcluidos
    ? `${excluidos.length} contatos excluídos · ${mostrados} nesta lista`
    : `${contatos.length} contatos · ${mostrados} nesta aba`;
}

function mudarFiltro(novoFiltro) {
  filtro = novoFiltro;
  document.querySelectorAll(".abas button").forEach((botao) => {
    botao.classList.toggle("ativa", botao.dataset.filtro === filtro);
  });
  desenhar();
}

// ---------- leitura do texto colado ----------

function soDigitos(texto) {
  return texto.replace(/\D/g, "");
}

function pareceTelefone(texto) {
  return /^\+?[\d\s()\-.]+$/.test(texto) && soDigitos(texto).length >= 10;
}

// recebe uma linha e devolve { nome, telefone } (telefone vazio se não achar)
function separarLinha(linha) {
  if (pareceTelefone(linha)) {
    return { nome: "", telefone: linha };
  }

  // formato "nome<tab>numero", "nome;numero" ou "nome|numero"
  const partes = linha.split(/[\t;|]/).map((p) => p.trim()).filter(Boolean);
  if (partes.length > 1) {
    const posicao = partes.findIndex(pareceTelefone);
    if (posicao >= 0) {
      const telefone = partes[posicao];
      const nome = partes.filter((_, i) => i !== posicao).join(" ");
      return { nome, telefone };
    }
  }

  // número no fim da linha
  let achou = linha.match(/^(.*?)\s+(\+?[\d(][\d ()\-.]{8,}\d)$/);
  if (achou) return { nome: achou[1], telefone: achou[2] };

  // número no começo da linha
  achou = linha.match(/^(\+?[\d(][\d ()\-.]{8,}\d)\s+(.*)$/);
  if (achou) return { nome: achou[2], telefone: achou[1] };

  return { nome: "", telefone: "" };
}

function lerLista(texto) {
  const validos = [];
  const invalidos = [];

  texto.split(/\r?\n/).forEach((original) => {
    const linha = original.trim();
    if (!linha) return;

    const { nome, telefone } = separarLinha(linha);
    let numero = soDigitos(telefone);

    if (numero.length < 10 || numero.length > 15) {
      invalidos.push(linha);
      return;
    }

    // número só com DDD, sem código do país
    if (numero.length <= 11) numero = "55" + numero;

    const nomeLimpo = nome.replace(/^[\s,:;\-–|"']+|[\s,:;\-–|"']+$/g, "");
    validos.push({ nome: nomeLimpo || "(sem nome)", numero, etapa: 0, ultima: null });
  });

  return { validos, invalidos };
}

function adicionarContatos() {
  const texto = $("areaColar").value;
  if (!texto.trim()) return;

  const { validos, invalidos } = lerLista(texto);
  const existentes = new Set(contatos.map((c) => c.numero));
  const novos = [];
  let repetidos = 0;

  validos.forEach((contato) => {
    if (existentes.has(contato.numero)) {
      repetidos++;
    } else {
      existentes.add(contato.numero);
      novos.push(contato);
    }
  });

  contatos = novos.concat(contatos);
  salvar();
  $("areaColar").value = "";
  mudarFiltro("0");

  let mensagem = `${novos.length} adicionados`;
  if (repetidos) mensagem += ` · ${repetidos} repetidos`;
  if (invalidos.length) mensagem += ` · ${invalidos.length} sem número válido`;
  avisar(mensagem, 3000);
}

// ---------- backup ----------

function exportar() {
  const dados = JSON.stringify({ perfil: perfilAtual, contatos, excluidos }, null, 2);
  const arquivo = new Blob([dados], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(arquivo);
  link.download = `contatos-${perfilAtual}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function normalizar(item) {
  const etapa = Number(item.etapa);
  return {
    nome: String(item.nome || "(sem nome)"),
    numero: soDigitos(String(item.numero || "")),
    etapa: etapa >= 0 && etapa <= ULTIMA_ETAPA ? etapa : 0,
    ultima: item.ultima || null,
  };
}

async function importar(arquivo) {
  try {
    const dados = JSON.parse(await arquivo.text());
    const lista = (Array.isArray(dados) ? dados : dados.contatos).map(normalizar);
    const validos = lista.filter((c) => c.numero.length >= 10);
    const listaExcluidos = Array.isArray(dados) ? [] : (dados.excluidos || []).map((item) => ({
      ...normalizar(item),
      excluidoEm: item.excluidoEm || Date.now()
    })).filter((c) => c.numero.length >= 10);

    if (!confirm(`Substituir a lista do perfil "${perfilAtual}" por ${validos.length} contatos do arquivo?`)) return;

    contatos = validos;
    excluidos = listaExcluidos;
    salvar();
    mudarFiltro("0");
    avisar("Backup importado");
  } catch (erro) {
    avisar("Arquivo inválido", 3000);
  }
}

// ---------- eventos ----------

document.querySelectorAll(".abas button").forEach((botao) => {
  botao.addEventListener("click", () => mudarFiltro(botao.dataset.filtro));
});

$("busca").addEventListener("input", desenhar);
$("prefixo").addEventListener("input", desenhar);

$("selPerfil").addEventListener("change", () => abrirPerfil($("selPerfil").value));
$("btnNovoPerfil").addEventListener("click", novoPerfil);
$("btnExcluirPerfil").addEventListener("click", excluirPerfil);

$("btnColar").addEventListener("click", () => {
  const painel = $("painelColar");
  painel.hidden = !painel.hidden;
  if (!painel.hidden) $("areaColar").focus();
});

$("btnAdicionar").addEventListener("click", adicionarContatos);

// ao colar, adiciona sem precisar clicar em nada
$("areaColar").addEventListener("paste", () => setTimeout(adicionarContatos, 0));

$("btnOrdenar").addEventListener("click", () => {
  contatos.sort((a, b) => a.nome.localeCompare(b.nome, "pt", { sensitivity: "base" }));
  salvar();
  desenhar();
  avisar("Ordenado de A a Z");
});

$("btnExportar").addEventListener("click", exportar);
$("btnImportar").addEventListener("click", () => $("arquivoImportar").click());
$("arquivoImportar").addEventListener("change", (evento) => {
  const arquivo = evento.target.files[0];
  if (arquivo) importar(arquivo);
  evento.target.value = "";
});

$("btnApagar").addEventListener("click", () => {
  if (!confirm("Apagar toda a lista deste perfil?")) return;
  contatos = [];
  salvar();
  desenhar();
});

iniciarPerfis();
