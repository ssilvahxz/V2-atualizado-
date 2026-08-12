const categories = ["Inteligência Artificial", "ChatGPT", "Google Gemini", "Claude", "Prompt Engineering", "Python", "Machine Learning", "Deep Learning", "Automação", "Desenvolvimento Web", "Imagens com IA", "Vídeos com IA", "Marketing com IA", "IA para Negócios", "Data Science", "Robótica"];
const topics = ["Fundamentos de IA", "ChatGPT", "Prompt Engineering", "Python para IA", "Machine Learning", "Automação Inteligente", "Criação de Imagens", "Criação de Vídeos", "Marketing com IA", "Agentes de IA", "Dados e IA", "APIs de IA", "Produtos com IA", "IA para Negócios", "IA para Criadores", "Visão Computacional"];
const levels = ["Iniciante", "Intermediário", "Avançado", "Especialista"];
const lessonNames = ["Introdução e objetivos", "Conceitos fundamentais", "Ferramentas e configuração", "Primeiro projeto", "Técnicas e boas práticas", "Projeto guiado", "Exercícios e revisão", "Desafio final"];

let courses = Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    title: `${topics[i % topics.length]} — ${levels[i % 4]} #${i + 1}`,
    category: categories[i % categories.length],
    level: levels[i % 4],
    modules: 3 + (i % 4),
    duration: `${2 + (i % 10)}h`,
    rating: (4.5 + (i % 5) / 10).toFixed(1),
    students: 150 + i * 31,
    price: i % 5 === 0 ? 0 : [19.9, 29.9, 49.9, 69.9][i % 4],
    description: `Trilha prática de ${topics[i % topics.length].toLowerCase()} com conteúdo estruturado, exercícios e acompanhamento.`,
    lessonsData: {} // Armazena explicações, resumos e imagens geradas por aula
}));

let S = {
    page: "home",
    q: "",
    cat: "Todas",
    course: null,
    lesson: 0,
    user: null,
    enrolled: {},
    done: {},
    aiSettings: { generateImages: true, countPerLesson: 1 }
};

try {
    Object.assign(S, JSON.parse(localStorage.getItem("nexora_v2") || "{}"));
} catch { }

function save() {
    localStorage.setItem("nexora_v2", JSON.stringify(S));
}

function esc(x = "") {
    return String(x).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ============================================================
   MOTOR DE IMAGENS CONTEXTUALIZADAS (NEXORA AI)
   Gera prompts específicos por aula e transforma em uma imagem
   real via API pública de geração de imagem por texto, sem
   necessidade de chave de API no cliente.
   Ponto único de integração: se no futuro vocês conectarem um
   provedor próprio (ex.: backend com DALL·E/Stability/Flux via
   servidor), basta trocar o corpo de buildImageUrl().
   ============================================================ */

// Hash simples e determinístico (mesmo texto = mesma seed = imagem estável até ser regenerada)
function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
    return Math.abs(h) % 999999;
}

// Monta um prompt específico e coerente para a aula, evitando aparência artificial e textos na imagem
function buildLessonImagePrompt(course, lessonTitle, variationIndex = 0, customFocus = "") {
    let focus = customFocus?.trim() || `${lessonTitle} no contexto de ${course.category}`;
    let angles = [
        "fotografia editorial profissional, plano médio, foco nítido no assunto principal",
        "ilustração digital estilo editorial moderno, composição limpa e equilibrada",
        "cena realista de ambiente de trabalho ou estudo, profundidade de campo suave"
    ];
    let angle = angles[variationIndex % angles.length];
    return [
        `Ilustração educacional profissional sobre: ${focus}.`,
        `Estilo: ${angle}.`,
        "Iluminação natural e suave, cores coerentes, anatomia e proporções humanas consistentes,",
        "composição limpa tipo material didático premium, sem textos, sem letras, sem legendas, sem logotipos,",
        "sem elementos aleatórios ou distorcidos, aparência natural e não excessivamente artificial."
    ].join(" ");
}

// Resumo em PT-BR exibido junto da imagem (não vai para o gerador, é só a legenda mostrada ao aluno)
function buildLessonImageSummary(course, lessonTitle, customFocus = "") {
    let focus = customFocus?.trim() || lessonTitle.toLowerCase();
    return `Ilustração educacional mostrando uma pessoa aplicando ${focus}, dentro do curso de ${course.category}.`;
}

// Constrói a URL real da imagem gerada por IA (Pollinations — geração por texto, sem chave de API)
function buildImageUrl(prompt, seed) {
    let encoded = encodeURIComponent(prompt);
    return `https://gen.pollinations.ai/image/${encoded}?width=1024&height=576&seed=${seed}&nologo=true&model=flux`;
}

// Gera o array de imagens (dados) de uma aula, respeitando a config do admin (0 a 3 por aula)
function generateLessonImages(course, lessonTitle, count) {
    let imgs = [];
    for (let i = 0; i < count; i++) {
        let prompt = buildLessonImagePrompt(course, lessonTitle, i);
        let summary = buildLessonImageSummary(course, lessonTitle);
        let seed = hashSeed(prompt + "_" + i);
        imgs.push({ prompt, summary, seed, url: buildImageUrl(prompt, seed) });
    }
    return imgs;
}

// Renderiza a galeria de imagens da aula em HTML, com controles de ADM para regenerar/substituir manualmente
function renderLessonImagesHtml(cid, lessonKey, lessonTitle, imgs, isAdmin) {
    if (!imgs || !imgs.length) return "";
    return `<div class="imgGallery">${imgs.map((img, idx) => `
        <figure class="lessonImg">
            <img src="${esc(img.url)}" alt="${esc(img.summary)}" loading="lazy"
                 onerror="this.onerror=null;this.src='';this.closest('.lessonImg').classList.add('imgFallback');">
            <figcaption><b>Resumo da imagem:</b> ${esc(img.summary)}</figcaption>
            ${isAdmin ? `
            <div class="imgAdminBar">
                <button class="btn" onclick="regenerateLessonImage(${cid},'${esc(lessonKey)}','${esc(lessonTitle).replace(/'/g, "\\'")}',${idx})">🔁 Regenerar</button>
                <button class="btn" onclick="replaceLessonImageManually(${cid},'${esc(lessonKey)}',${idx})">🖼️ Substituir manualmente</button>
            </div>` : ""}
        </figure>
    `).join("")}</div>`;
}

// ADM: regenera uma imagem específica, opcionalmente com um novo foco/descrição
function regenerateLessonImage(cid, lessonKey, lessonTitle, idx) {
    let c = courses.find(x => x.id === cid);
    if (!c || !c.lessonsData[lessonKey]) return;
    let novoFoco = prompt("Descreva o que a nova imagem deve mostrar (deixe em branco para manter o mesmo tema):", "") || "";
    let newPrompt = buildLessonImagePrompt(c, lessonTitle, idx, novoFoco);
    let newSummary = buildLessonImageSummary(c, lessonTitle, novoFoco);
    let newSeed = hashSeed(newPrompt + "_" + Date.now());
    c.lessonsData[lessonKey].imgs[idx] = { prompt: newPrompt, summary: newSummary, seed: newSeed, url: buildImageUrl(newPrompt, newSeed) };
    render();
}

// ADM: substitui a imagem por uma URL enviada manualmente (ex.: upload próprio hospedado)
function replaceLessonImageManually(cid, lessonKey, idx) {
    let c = courses.find(x => x.id === cid);
    if (!c || !c.lessonsData[lessonKey]) return;
    let url = prompt("Cole a URL da imagem que deseja usar nesta aula:", "");
    if (!url) return;
    c.lessonsData[lessonKey].imgs[idx].url = url.trim();
    render();
}

function go(p) {
    S.page = p;
    render();
    scrollTo(0, 0);
}

function side() {
    let isAdmin = S.user?.email === "lorielsilvadosreis014@gmail.com" || S.user?.admin;
    return `
        <button class="${S.page === 'home' ? 'active' : ''}" onclick="go('home')">⌂ Início</button>
        <button class="${S.page === 'courses' ? 'active' : ''}" onclick="go('courses')">▦ Cursos</button>
        <button onclick="go('categories')">◈ Categorias</button>
        <button onclick="go('dashboard')">◉ Meu aprendizado</button>
        <button onclick="go('plans')">◇ Planos</button>
        <button onclick="go('profile')">● Perfil</button>
        <button class="${S.page === 'generator' ? 'active' : ''}" onclick="go('generator')">🤖 Gerar Curso com IA</button>
        ${isAdmin ? `<hr><button class="${S.page === 'admin' ? 'active' : ''}" onclick="go('admin')">⚙ Admin</button>` : ""}
    `;
}

function shell(c) {
    document.querySelector("#app").innerHTML = `
        <header class="top">
            <div class="brand" onclick="go('home')" style="cursor:pointer">NEXORA <em>AI</em></div>
            <input class="search" placeholder="Pesquisar cursos, IA, programação..." value="${esc(S.q)}" oninput="S.q=this.value;render()">
            <nav class="nav">
                <button class="btn desktop" onclick="go('courses')">Cursos</button>
                <button class="btn primary" onclick="${S.user ? "go('dashboard')" : "auth()"}">${S.user ? esc(S.user.name) : "Entrar"}</button>
            </nav>
        </header>
        <div class="layout">
            <aside class="side">${side()}</aside>
            <main class="main">${c}</main>
        </div>
        <footer class="footer">NEXORA AI — Aprenda. Crie. Evolua com IA.</footer>
    `;
}

function card(c) {
    return `
        <article class="card">
            <div class="cover">N${c.id % 10}</div>
            <div class="body">
                <span class="tag">${c.level}</span>
                <h3>${esc(c.title)}</h3>
                <p class="muted">${esc(c.description)}</p>
                <div class="row space"><span>★ ${c.rating}</span><span>${c.price ? "R$ " + c.price.toFixed(2) : "Grátis"}</span></div>
                <button class="btn primary" style="width:100%;margin-top:12px" onclick="openCourse(${c.id})">Abrir curso</button>
            </div>
        </article>
    `;
}

function home() {
    return `
        <section class="hero">
            <div class="logoMark">NEXORA AI</div>
            <h1>O próximo passo da sua evolução com Inteligência Artificial.</h1>
            <p>Aprenda ferramentas, programação, automação e estratégias de IA em uma plataforma criada com identidade própria para quem quer evoluir.</p>
            <div class="row">
                <button class="btn primary" onclick="go('courses')">Explorar ${courses.length} cursos</button>
                <button class="btn" onclick="go('generator')">🤖 Criar Curso com IA</button>
            </div>
            <div class="stats">
                <div class="stat"><b>${courses.length}</b><span class="muted">cursos</span></div>
                <div class="stat"><b>8.000+</b><span class="muted">aulas estruturadas</span></div>
                <div class="stat"><b>16</b><span class="muted">categorias</span></div>
                <div class="stat"><b>24/7</b><span class="muted">aprendizado</span></div>
            </div>
        </section>
        <section class="section">
            <div class="head"><h2>Categorias</h2><button class="btn" onclick="go('categories')">Ver todas</button></div>
            <div class="grid">${categories.slice(0, 8).map(x => `<div class="card" onclick="S.cat='${esc(x)}';go('courses')"><div class="cover">✦</div><div class="body"><h3>${esc(x)}</h3><span class="muted">60+ cursos</span></div></div>`).join("")}</div>
        </section>
        <section class="section">
            <div class="head"><h2>Em destaque</h2><button class="btn" onclick="go('courses')">Catálogo</button></div>
            <div class="grid">${courses.slice(0, 8).map(card).join("")}</div>
        </section>
    `;
}

function coursesPage() {
    let list = courses.filter(c => (S.cat === "Todas" || c.category === S.cat) && (!S.q || `${c.title} ${c.category}`.toLowerCase().includes(S.q.toLowerCase())));
    return `
        <div class="head">
            <div><h2>Catálogo NEXORA AI</h2><span class="muted">${list.length} cursos encontrados</span></div>
            <select class="btn" onchange="S.cat=this.value;render()"><option>Todas</option>${categories.map(x => `<option ${S.cat === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>
        </div>
        <div class="grid">${list.slice(0, 48).map(card).join("")}</div>
    `;
}

function categoriesPage() {
    return `<h2>Categorias</h2><div class="grid section">${categories.map(x => `<div class="card" onclick="S.cat='${esc(x)}';go('courses')"><div class="cover">◈</div><div class="body"><h3>${esc(x)}</h3><span class="muted">Explorar cursos</span></div></div>`).join("")}</div>`;
}

function openCourse(id) {
    S.course = id;
    S.page = "detail";
    render();
}

function detail() {
    let c = courses.find(x => x.id === S.course), d = S.done[c.id] || [], total = c.modules * 8, p = Math.round(d.length / total * 100);
    return `
        <button class="btn" onclick="go('courses')">← Voltar</button>
        <div class="course section">
            <div>
                <div class="panel">
                    <div class="cover" style="height:240px">NEXORA AI</div>
                    <h1>${esc(c.title)}</h1>
                    <p class="muted">${esc(c.description)}</p>
                    <div class="row"><span>★ ${c.rating}</span><span>${c.level}</span><span>${c.duration}</span><span>${c.students.toLocaleString()} alunos</span></div>
                    <div style="margin-top:20px">
                        <div class="row space"><b>Progresso</b><span>${p}%</span></div>
                        <div class="progress"><i style="width:${p}%"></i></div>
                    </div>
                    <button class="btn primary" style="margin-top:16px" onclick="start(${c.id})">${S.enrolled[c.id] ? "Continuar" : "Começar curso"}</button>
                </div>
                <div class="panel section">
                    <h2>Conteúdo do Curso</h2>
                    ${Array.from({ length: c.modules }, (_, m) => `
                        <h3>Módulo ${m + 1}</h3>
                        ${lessonNames.map((x, j) => {
        let id = m * 8 + j;
        return `
                                <div class="lesson ${d.includes(id) ? "done" : ""}">
                                    <span>${d.includes(id) ? "✓" : "▶"}</span>
                                    <div><b>${esc(x)}</b><div class="muted">Aula ${id + 1} • ${10 + (id % 9)} min</div></div>
                                    <button class="btn" onclick="openLesson(${c.id},${id})">Abrir</button>
                                </div>
                            `;
    }).join("")}
                    `).join("")}
                </div>
            </div>
            <aside>
                <div class="panel">
                    <h3>Incluído</h3>
                    <p>✓ Aulas práticas</p>
                    <p>✓ Explicação e exemplos</p>
                    <p>✓ Exercícios & Resumos</p>
                    <p>✓ Imagens Ilustrativas Contextualizadas</p>
                    <p>✓ Certificado de Conclusão</p>
                    <p>✓ Tutor NEXORA AI</p>
                </div>
            </aside>
        </div>
    `;
}

function start(id) {
    S.enrolled[id] = true;
    save();
    openLesson(id, (S.done[id] || []).length);
}

function openLesson(cid, lid) {
    S.course = cid;
    S.lesson = lid;
    S.page = "lesson";
    render();
}

function lesson() {
    let c = courses.find(x => x.id === S.course), d = S.done[c.id] || [], lid = S.lesson || 0;
    let lName = lessonNames[lid % 8];
    
    // Geração dinâmica de conteúdo e imagens contextualizadas baseadas nas regras solicitadas
    let lessonKey = `${c.id}_${lid}`;
    let isAdmin = S.user?.email === "lorielsilvadosreis014@gmail.com" || S.user?.admin;
    if (!c.lessonsData) c.lessonsData = {};
    if (!c.lessonsData[lessonKey]) {
        let countImg = S.aiSettings.generateImages ? S.aiSettings.countPerLesson : 0;

        c.lessonsData[lessonKey] = {
            explanation: `Nesta aula sobre <b>${lName}</b>, exploramos os conceitos fundamentais aplicados a ${c.category}. O conteúdo é estruturado para garantir entendimento prático, alta retenção e aplicação imediata no mercado.`,
            examples: `Exemplo prático: Implementação guiada de ${lName.toLowerCase()} utilizando ferramentas modernas de Inteligência Artificial para otimizar fluxos de trabalho.`,
            exercises: `Exercício sugerido: Crie um pequeno projeto ou teste prático aplicando os conceitos abordados nesta aula e valide com o Tutor NEXORA AI.`,
            summary: `Resumo: Dominar ${lName} dentro do contexto de ${c.title} é essencial para elevar sua produtividade e capacitação técnica.`,
            imgs: generateLessonImages(c, lName, countImg)
        };
    }

    let ld = c.lessonsData[lessonKey];
    let imagesHtml = renderLessonImagesHtml(c.id, lessonKey, lName, ld.imgs, isAdmin);

    return `
        <button class="btn" onclick="openCourse(${c.id})">← Voltar ao Curso</button>
        <div class="course section">
            <div>
                <div class="panel">
                    <div class="cover" style="height:210px">▶ AULA ${lid + 1}</div>
                    <h1>${esc(lName)}</h1>
                    <p class="muted">Curso: ${esc(c.title)}</p>
                    
                    <div style="margin-top:20px;">
                        <h3>📖 Explicação</h3>
                        <p>${ld.explanation}</p>
                        
                        <h3>💡 Exemplos Práticos</h3>
                        <p>${ld.examples}</p>

                        ${imagesHtml}

                        <h3>📝 Exercícios</h3>
                        <p>${ld.exercises}</p>

                        <div class="panel" style="margin-top:15px; background:#080b12;">
                            <h3>📌 Resumo da Aula</h3>
                            <p class="muted">${ld.summary}</p>
                        </div>
                    </div>

                    <div class="panel" style="margin-top:20px;">
                        <h3>🤖 Tutor NEXORA AI</h3>
                        <p class="muted">Tire dúvidas específicas sobre esta aula com o assistente inteligente.</p>
                        <button class="btn primary" onclick="alert('Tutor NEXORA AI ativado para responder dúvidas sobre ${esc(lName)}.')">Perguntar à IA</button>
                    </div>

                    <div class="row space" style="margin-top:18px">
                        <button class="btn" onclick="openLesson(${c.id},${Math.max(0, lid - 1)})">← Anterior</button>
                        <button class="btn primary" onclick="done(${c.id},${lid})">${d.includes(lid) ? "Concluída ✓" : "Marcar como concluída"}</button>
                        <button class="btn" onclick="openLesson(${c.id},${Math.min(c.modules * 8 - 1, lid + 1)})">Próxima →</button>
                    </div>
                </div>
            </div>
            <aside>
                <div class="panel">
                    <h3>Aulas do Curso</h3>
                    ${Array.from({ length: c.modules * 8 }, (_, i) => `<div class="lesson ${i === lid ? "done" : ""}" onclick="openLesson(${c.id},${i})"><span>${d.includes(i) ? "✓" : "○"}</span><small>${i + 1}. ${esc(lessonNames[i % 8])}</small></div>`).join("")}
                </div>
            </aside>
        </div>
    `;
}

function done(cid, lid) {
    S.done[cid] ||= [];
    if (!S.done[cid].includes(lid)) S.done[cid].push(lid);
    save();
    render();
}

function generatorPage() {
    return `
        <h2>🤖 Gerador de Cursos com IA</h2>
        <p class="muted">Crie cursos completos estruturados instantaneamente com inteligência artificial.</p>
        <div class="panel section" style="max-width:700px">
            <label><b>O que você deseja aprender ou criar?</b></label>
            <input id="promptCourse" placeholder="Ex: Crie um curso completo de Marketing Digital com IA para iniciantes" style="width:100%; margin:10px 0 15px 0; padding:12px; background:#080b12; border:1px solid #2b334a; border-radius:9px; color:#fff;" />
            
            <label><b>Configuração de Imagens Ilustrativas</b></label>
            <div style="margin:10px 0 20px 0;">
                <label style="display:block; ma
