/**
 * build.js — gera dist/index.html com o JavaScript principal ofuscado.
 *
 * IMPORTANTE (leia antes de confiar cegamente nisto):
 * Ofuscação NÃO é criptografia nem proteção real. Qualquer pessoa com acesso
 * ao site pode abrir o DevTools, rodar o código e, com tempo, entender a lógica.
 * O que este script faz é dificultar a cópia/leitura casual (nomes de variáveis
 * embaralhados, strings codificadas, fluxo de controle achatado) — uma barreira
 * de "não vale o esforço para curiosos", não uma trava de segurança.
 * Segredos de verdade (senha de configuração, chave service_role do Supabase,
 * etc.) NUNCA devem depender disso — eles são protegidos pela criptografia
 * AES-GCM do config.html, não pela ofuscação do código.
 *
 * Uso:
 *   npm install javascript-obfuscator
 *   node build.js
 *
 * Gera: dist/index.html, dist/service-worker.js (cópia), dist/manifest.json (se existir)
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC_DIR = __dirname;
const DIST_DIR = path.join(__dirname, 'dist');

function main(){
  const srcPath = path.join(SRC_DIR, 'index.html');
  let html = fs.readFileSync(srcPath, 'utf8');

  // Extrai todos os blocos <script> sem atributo src (inline).
  const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
  const matches = [...html.matchAll(scriptRegex)];

  if(matches.length === 0){
    throw new Error('Nenhum <script> inline encontrado em index.html.');
  }

  // O script principal do app é o maior bloco inline (heurística simples e estável:
  // os outros dois são o check de versão no <head> e o registro do service worker).
  let mainIdx = 0;
  matches.forEach((m, i) => { if(m[1].length > matches[mainIdx][1].length) mainIdx = i; });

  const originalCode = matches[mainIdx][1];
  console.log(`Ofuscando bloco de script principal (${originalCode.length} caracteres)...`);

  const obfuscated = JavaScriptObfuscator.obfuscate(originalCode, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.3,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,       // evita quebrar funções chamadas via onclick="..." no HTML
    selfDefending: true,
    disableConsoleOutput: false
  }).getObfuscatedCode();

  // Reconstrói o HTML substituindo apenas o bloco selecionado, preservando os demais.
  let cursor = 0;
  let scriptCount = -1;
  const rebuilt = html.replace(scriptRegex, (full, code) => {
    scriptCount++;
    if(scriptCount === mainIdx){
      return `<script>${obfuscated}</script>`;
    }
    return full;
  });

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), rebuilt, 'utf8');
  console.log('Gravado dist/index.html');

  ['service-worker.js', 'manifest.json'].forEach(file => {
    const p = path.join(SRC_DIR, file);
    if(fs.existsSync(p)){
      fs.copyFileSync(p, path.join(DIST_DIR, file));
      console.log(`Copiado ${file} -> dist/`);
    }
  });

  const imagesDir = path.join(SRC_DIR, 'images');
  if(fs.existsSync(imagesDir)){
    fs.mkdirSync(path.join(DIST_DIR, 'images'), { recursive: true });
    for(const f of fs.readdirSync(imagesDir)){
      fs.copyFileSync(path.join(imagesDir, f), path.join(DIST_DIR, 'images', f));
    }
    console.log('Copiada pasta images/ -> dist/images/');
  }

  console.log('\nPronto. Publique o conteúdo de dist/ (não o index.html original) no GitHub Pages.');
  console.log('Mantenha o index.html original como sua fonte de trabalho/edição.');
}

main();
