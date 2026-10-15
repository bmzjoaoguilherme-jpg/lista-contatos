const CHAVE_CONTATOS = "contatos";
const CHAVE_LIGADOS = "ligados";

let contatos = carregar(CHAVE_CONTATOS, []);
let ligados = carregar(CHAVE_LIGADOS, {});
let filtro = "pendentes";

const $ = (id) => document.getElementById(id);

function carregar(chave, padrao) {
  try {
    const salvo = localStorage.getItem(chave);
    return salvo ? JSON.parse(salvo) : padrao;
  } catch (erro) {
    return padrao;
  }
}

function salvar() {
  try {
    localStorage.setItem(CHAVE_CONTATOS, JSON.stringify(contatos));
    localStorage.setItem(CHAVE_LIGADOS, JSON.stringify(ligados));
  } catch (erro) {
    // sem localStorage (modo privado, por exemplo), segue sem salvar
  }
}

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

function desenhar() {
  const busca = $("busca").value.toLowerCase();
  const tabela = $("tabela");
  tabela.innerHTML = "";
  let mostrados = 0;

  contatos.forEach((contato) => {
    const feito = Boolean(ligados[contato.numero]);

    if (filtro === "pendentes" && feito) return;
    if (filtro === "ligados" && !feito) return;
    if (busca && !contato.nome.toLowerCase().includes(busca) && !contato.numero.includes(busca)) return;

    mostrados++;

    const linha = document.createElement("tr");
    if (feito) linha.className = "feito";

    const celulaNome = document.createElement("td");
    celulaNome.className = "nome";
    celulaNome.textContent = contato.nome;

    const celulaNumero = document.createElement("td");
    celulaNumero.className = "numero";
    celulaNumero.textContent = formatarNumero(contato.numero);
    celulaNumero.addEventListener("click", () => {
      copiar(formatarNumero(contato.numero));
      celulaNumero.classList.add("copiado");
      setTimeout(() => celulaNumero.classList.remove("copiado"), 500);
    });

    const celulaBotao = document.createElement("td");
    celulaBotao.className = "botao-celula";
    const botao = document.createElement("button");
    botao.className = "btn";
    botao.textContent = feito ? "✓ Liguei" : "Liguei";
    botao.addEventListener("click", () => {
      if (ligados[contato.numero]) {
        delete ligados[contato.numero];
      } else {
        ligados[contato.numero] = true;
      }
      salvar();
      desenhar();
    });
    celulaBotao.appendChild(botao);

    linha.append(celulaNome, celulaNumero, celulaBotao);
    tabela.appendChild(linha);
  });

  const total = contatos.length;
  const jaLigados = contatos.filter((c) => ligados[c.numero]).length;
  $("contador").textContent = `${jaLigados}/${total} ligados · ${mostrados} na lista`;
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
    validos.push({ nome: nomeLimpo || "(sem nome)", numero });
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
  mudarFiltro("pendentes");

  let mensagem = `${novos.length} adicionados`;
  if (repetidos) mensagem += ` · ${repetidos} repetidos`;
  if (invalidos.length) mensagem += ` · ${invalidos.length} sem número válido`;
  avisar(mensagem, 3000);
}

function mudarFiltro(novoFiltro) {
  filtro = novoFiltro;
  document.querySelectorAll(".abas button").forEach((botao) => {
    botao.classList.toggle("ativa", botao.dataset.filtro === filtro);
  });
  desenhar();
}

// ---------- eventos ----------

document.querySelectorAll(".abas button").forEach((botao) => {
  botao.addEventListener("click", () => mudarFiltro(botao.dataset.filtro));
});

$("busca").addEventListener("input", desenhar);
$("prefixo").addEventListener("input", desenhar);

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

$("btnApagar").addEventListener("click", () => {
  if (!confirm("Apagar toda a lista?")) return;
  contatos = [];
  ligados = {};
  salvar();
  desenhar();
});

desenhar();
