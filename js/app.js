/* =========================================================================
   Angielski B1-B2 - codzienna dawka
   Cała aplikacja działa lokalnie w przeglądarce. Postęp trzymamy w
   localStorage, więc nauka jest prywatna i działa też bez internetu.
   ========================================================================= */
(function () {
  "use strict";

  /* ------------------------- narzędzia ------------------------- */
  var VOCAB = window.VOCAB || [];
  var PATTERNS = window.PATTERNS || [];
  var MISTAKES = window.MISTAKES || [];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
      "-" + String(d.getDate()).padStart(2, "0");
  }
  function today() { return iso(new Date()); }
  function shift(dayStr, days) {
    var p = dayStr.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + days);
    return iso(d);
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function plural(n, one, few, many) {
    var n10 = n % 10, n100 = n % 100;
    if (n === 1) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }
  var PL_DAYS = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  var PL_MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  function prettyDate(dayStr) {
    var p = dayStr.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return PL_DAYS[d.getDay()] + ", " + d.getDate() + " " + PL_MONTHS[d.getMonth()];
  }

  /* ------------------------- pamięć postępu ------------------------- */
  var KEY = "kurs-angielskiego.v1";
  var state;

  function freshState() {
    return {
      v: 1,
      order: shuffle(VOCAB.map(function (_, i) { return i; })),
      cursor: 0,
      patternCursor: 0,
      mistakeCursor: 0,
      wordsPerDay: 5,
      day: null,
      todayWords: [],
      todayPattern: 0,
      todayMistakes: [],
      quiz: null,          // {score:n, total:n}
      srs: {},             // index -> {box, due, seen, ok}
      tasks: {},           // index wzorca -> tekst użytkownika
      issued: [],          // historia wydanych słów
      streak: 0,
      lastDone: null,
      daysDone: []
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return freshState();
      var s = JSON.parse(raw);
      var f = freshState();
      for (var k in f) if (!(k in s)) s[k] = f[k];
      if (!s.order || s.order.length !== VOCAB.length) {
        s.order = f.order;               // baza słów się zmieniła - tasujemy od nowa
        s.cursor = 0;
      }
      return s;
    } catch (e) { return freshState(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* prywatny tryb */ }
  }

  /* ------------------------- dzienna porcja ------------------------- */
  function nextWords(n) {
    var out = [];
    for (var i = 0; i < n && VOCAB.length; i++) {
      out.push(state.order[state.cursor % state.order.length]);
      state.cursor++;
    }
    return out;
  }
  function ensureDay() {
    var t = today();
    if (state.day === t && state.todayWords.length) return;
    state.day = t;
    state.todayWords = nextWords(state.wordsPerDay);
    state.todayPattern = PATTERNS.length ? state.patternCursor % PATTERNS.length : 0;
    state.patternCursor = (state.patternCursor + 1) % Math.max(PATTERNS.length, 1);
    state.todayMistakes = [];
    for (var i = 0; i < 2 && MISTAKES.length; i++) {
      state.todayMistakes.push(state.mistakeCursor % MISTAKES.length);
      state.mistakeCursor = (state.mistakeCursor + 1) % MISTAKES.length;
    }
    state.quiz = null;
    state.todayWords.forEach(function (idx) {
      if (!state.srs[idx]) state.srs[idx] = { box: 1, due: shift(t, 1), seen: 0, ok: 0 };
      if (state.issued.indexOf(idx) < 0) state.issued.push(idx);
    });
    save();
  }

  /* ------------------------- powtórki (SRS) ------------------------- */
  var INTERVALS = [1, 2, 4, 8, 16, 32, 60];   // dni dla kolejnych pudełek
  function dueList() {
    var t = today(), out = [];
    for (var idx in state.srs) {
      if (state.srs[idx].due <= t) out.push(+idx);
    }
    return out.sort(function (a, b) { return state.srs[a].due < state.srs[b].due ? -1 : 1; });
  }
  function grade(idx, ok) {
    var c = state.srs[idx] || (state.srs[idx] = { box: 1, due: today(), seen: 0, ok: 0 });
    c.seen++;
    if (ok) {
      c.ok++;
      c.box = Math.min(c.box + 1, INTERVALS.length);
      c.due = shift(today(), INTERVALS[c.box - 1]);
    } else {
      c.box = 1;
      c.due = shift(today(), 1);
    }
    save();
  }
  function mastered() {
    var n = 0;
    for (var i in state.srs) if (state.srs[i].box >= 5) n++;
    return n;
  }

  /* ------------------------- seria dni ------------------------- */
  function visibleStreak() {
    if (!state.lastDone) return 0;
    var t = today();
    if (state.lastDone === t || state.lastDone === shift(t, -1)) return state.streak;
    return 0;
  }
  function markDayDone() {
    var t = today();
    if (state.lastDone === t) return;
    state.streak = (state.lastDone === shift(t, -1)) ? state.streak + 1 : 1;
    state.lastDone = t;
    if (state.daysDone.indexOf(t) < 0) state.daysDone.push(t);
    save();
  }

  /* ------------------------- wymowa ------------------------- */
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      var u = new SpeechSynthesisUtterance(String(text).replace(/\s*\(.*?\)\s*/g, " "));
      u.lang = "en-GB"; u.rate = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* brak głosu w systemie */ }
  }

  /* ------------------------- widoki ------------------------- */
  var view = document.getElementById("view");

  function wordCard(idx, opts) {
    opts = opts || {};
    var w = VOCAB[idx];
    var hidden = opts.hideTranslation;
    return '' +
      '<article class="card" data-word="' + idx + '">' +
        '<div class="word">' +
          '<div>' +
            '<div class="word-en">' + esc(w.w) + '<span class="pos">' + esc(w.pos) + '</span></div>' +
            '<div class="ipa">' + esc(w.ipa || "") + '</div>' +
          '</div>' +
          '<button class="iconbtn" type="button" data-speak="' + esc(w.w) + '" title="Przeczytaj na głos" aria-label="Przeczytaj na głos">&#128266;</button>' +
        '</div>' +
        (hidden
          ? '<div class="reveal"><button class="btn slim ghost" type="button" data-reveal="' + idx + '">Pokaż tłumaczenie i przykład</button></div>' +
            '<div class="hidden-part" hidden>' + wordBody(w) + '</div>'
          : wordBody(w)) +
      '</article>';
  }
  function wordBody(w) {
    return '<p class="pl">' + esc(w.pl) + '</p>' +
      '<div class="ex">' +
        '<p class="en">' + esc(w.ex) + '</p>' +
        '<p class="plx">' + esc(w.exPl) + '</p>' +
      '</div>' +
      (w.coll ? '<p class="coll">Kolokacje: ' + esc(w.coll) + '</p>' : "");
  }

  function renderToday() {
    ensureDay();
    var quizDone = state.quiz && state.quiz.total;
    var p = PATTERNS[state.todayPattern] || null;
    var h = '';

    h += '<div class="section-title"><h1>Lekcja na dziś</h1><small>' + esc(prettyDate(state.day)) + '</small></div>';
    h += '<div class="card tight"><div class="row between">' +
           '<span class="small muted">' + state.todayWords.length + ' ' + plural(state.todayWords.length, "nowe słowo", "nowe słowa", "nowych słów") +
           ' &middot; 1 wzorzec wypowiedzi &middot; quiz</span>' +
           (quizDone ? '<span class="small" style="color:var(--good);font-weight:700">zaliczone &#10003;</span>' : '') +
         '</div></div>';

    h += '<div class="section-title"><h2>1. Nowe słowa</h2><small>najpierw spróbuj przypomnieć sobie znaczenie</small></div>';
    state.todayWords.forEach(function (idx) { h += wordCard(idx, { hideTranslation: true }); });

    h += '<div class="section-title"><h2>2. Poprawna forma wypowiedzi</h2><small>' + esc(p ? p.cat : "") + '</small></div>';
    if (p) h += patternCard(state.todayPattern, true);

    h += '<div class="section-title"><h2>3. Błąd, którego warto unikać</h2><small>typowa kalka z polskiego</small></div>';
    state.todayMistakes.forEach(function (mi) { h += mistakeCard(mi); });

    h += '<div class="section-title"><h2>4. Quiz dnia</h2><small>' + (quizDone ? "wynik: " + state.quiz.score + "/" + state.quiz.total : "utrwala dzisiejszy materiał") + '</small></div>';
    h += '<div class="card" id="quizBox">' +
      (quizDone
        ? '<div class="done-note">Dzień zaliczony. Wynik: ' + state.quiz.score + '/' + state.quiz.total + '.</div>' +
          '<div class="row" style="margin-top:12px"><button class="btn slim" type="button" id="startQuiz">Powtórz quiz</button></div>'
        : '<p class="muted small">' + (state.todayWords.length + 2) + ' krótkich pytań. Ukończenie quizu zamyka dzień i podbija serię.</p>' +
          '<button class="btn primary block" type="button" id="startQuiz">Rozpocznij quiz</button>') +
      '</div>';

    view.innerHTML = h;
    wireCommon();
    var sq = document.getElementById("startQuiz");
    if (sq) sq.addEventListener("click", startQuiz);
  }

  function patternCard(pi, withTask) {
    var p = PATTERNS[pi];
    var saved = state.tasks[pi] || "";
    var h = '<article class="card">' +
      '<h3>' + esc(p.title) + '</h3>' +
      '<p class="small muted">' + esc(p.why) + '</p>' +
      '<div class="forms">' + p.forms.map(function (f) { return '<code>' + esc(f) + '</code>'; }).join("") + '</div>';
    p.ex.forEach(function (e) {
      h += '<div class="ex"><p class="en">' + esc(e.en) +
        ' <button class="iconbtn" type="button" data-speak="' + esc(e.en) + '" aria-label="Przeczytaj na głos" style="width:28px;height:28px;font-size:.8rem;vertical-align:middle">&#128266;</button></p>' +
        '<p class="plx">' + esc(e.pl) + '</p></div>';
    });
    if (p.avoid) h += '<p class="avoid">Uwaga: ' + esc(p.avoid) + '</p>';
    if (withTask) {
      h += '<div class="stack" style="margin-top:14px">' +
        '<label class="small" style="font-weight:600" for="taskBox">Zadanie: ' + esc(p.task) + '</label>' +
        '<textarea id="taskBox" data-task="' + pi + '" placeholder="Napisz po angielsku...">' + esc(saved) + '</textarea>' +
        '<div class="row"><button class="btn slim" type="button" id="showModel">Pokaż wzorcową odpowiedź</button>' +
        '<button class="btn slim ghost" type="button" data-speak="' + esc(p.model) + '">&#128266; Posłuchaj</button></div>' +
        '<div id="modelAns" hidden><div class="feedback ok"><strong>Przykładowa odpowiedź</strong>' + esc(p.model) + '</div></div>' +
        '</div>';
    }
    h += '</article>';
    return h;
  }

  function mistakeCard(mi) {
    var m = MISTAKES[mi];
    return '<article class="card">' +
      '<p class="wrongline"><b>&#10007;</b><span>' + esc(m.wrong) + '</span></p>' +
      '<p class="rightline"><b>&#10003;</b><span>' + esc(m.right) + '</span></p>' +
      '<p class="why">' + esc(m.why) + '</p>' +
    '</article>';
  }

  /* ------------------------- quiz ------------------------- */
  var quiz = null;

  function blankOut(sentence, word) {
    var key = String(word).replace(/^to\s+/i, "").replace(/\s*\(.*?\)\s*/g, " ").trim();
    var cands = [key];
    var first = key.split(/[\s\/]+/)[0];
    if (first && first.length > 3) cands.push(first);
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var re = new RegExp(c.replace(/\s+/g, "\\s+") + "\\w*", "i");
      if (re.test(sentence)) return sentence.replace(re, "____");
    }
    return null;
  }

  function buildQuiz() {
    var qs = [];
    var pool = VOCAB.map(function (_, i) { return i; });

    state.todayWords.forEach(function (idx, n) {
      var w = VOCAB[idx];
      var wrong = shuffle(pool.filter(function (i) { return i !== idx; })).slice(0, 3).map(function (i) { return VOCAB[i].w; });
      var gap = n % 2 === 1 ? blankOut(w.ex, w.w) : null;
      if (gap) {
        qs.push({
          kind: "word", idx: idx,
          prompt: 'Uzupełnij zdanie: <span class="gap">____</span>',
          sub: gap, subPl: w.exPl,
          options: shuffle([w.w].concat(wrong)), answer: w.w,
          why: w.w + " - " + w.pl
        });
      } else {
        qs.push({
          kind: "word", idx: idx,
          prompt: "Jak powiedzieć po angielsku?",
          sub: w.pl, subPl: "",
          options: shuffle([w.w].concat(wrong)), answer: w.w,
          why: w.ex + " (" + w.exPl + ")"
        });
      }
    });

    state.todayMistakes.forEach(function (mi) {
      var m = MISTAKES[mi];
      qs.push({
        kind: "mistake",
        prompt: "Która wersja jest poprawna?",
        sub: "", subPl: "",
        options: shuffle([m.right, m.wrong]), answer: m.right,
        why: m.why
      });
    });

    return qs;
  }

  function startQuiz() {
    quiz = { qs: buildQuiz(), at: 0, score: 0, wrong: [] };
    renderQuestion();
    var box = document.getElementById("quizBox");
    if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderQuestion() {
    var box = document.getElementById("quizBox");
    if (!box) return;
    if (quiz.at >= quiz.qs.length) return finishQuiz();

    var q = quiz.qs[quiz.at];
    var pct = Math.round(quiz.at / quiz.qs.length * 100);
    var h = '<div class="progressline"><i style="width:' + pct + '%"></i></div>' +
      '<p class="small muted">Pytanie ' + (quiz.at + 1) + ' z ' + quiz.qs.length + '</p>' +
      '<p class="q">' + q.prompt + '</p>' +
      (q.sub ? '<p class="q" style="font-weight:600">' + esc(q.sub) + '</p>' : '') +
      (q.subPl ? '<p class="small muted">' + esc(q.subPl) + '</p>' : '') +
      '<div id="opts">' + q.options.map(function (o, i) {
        return '<button class="opt" type="button" data-opt="' + i + '">' + esc(o) + '</button>';
      }).join("") + '</div>' +
      '<div id="qFeedback"></div>';
    box.innerHTML = h;

    box.querySelectorAll("[data-opt]").forEach(function (b) {
      b.addEventListener("click", function () { answer(+b.getAttribute("data-opt")); });
    });
  }

  function answer(i) {
    var q = quiz.qs[quiz.at];
    var chosen = q.options[i];
    var ok = chosen === q.answer;
    if (ok) quiz.score++; else quiz.wrong.push(q);
    if (q.kind === "word") grade(q.idx, ok);

    var box = document.getElementById("quizBox");
    box.querySelectorAll("[data-opt]").forEach(function (b, n) {
      b.disabled = true;
      if (q.options[n] === q.answer) b.classList.add("is-right");
      else if (n === i) b.classList.add("is-wrong");
    });
    if (ok) speak(q.answer);

    document.getElementById("qFeedback").innerHTML =
      '<div class="feedback ' + (ok ? "ok" : "no") + '">' +
        '<strong>' + (ok ? "Dobrze!" : "Poprawnie: " + esc(q.answer)) + '</strong>' +
        esc(q.why) +
      '</div>' +
      '<button class="btn primary block" type="button" id="nextQ" style="margin-top:10px">' +
        (quiz.at + 1 >= quiz.qs.length ? "Zakończ quiz" : "Następne pytanie") +
      '</button>';
    document.getElementById("nextQ").addEventListener("click", function () {
      quiz.at++; renderQuestion();
    });
  }

  function finishQuiz() {
    state.quiz = { score: quiz.score, total: quiz.qs.length };
    markDayDone();
    save();
    refreshChrome();

    var box = document.getElementById("quizBox");
    var pct = Math.round(quiz.score / quiz.qs.length * 100);
    var msg = pct === 100 ? "Bezbłędnie. Świetna robota!" :
      pct >= 70 ? "Dobry wynik. Słabsze słowa wrócą w powtórkach." :
        "Nic straconego - te słowa wrócą jutro w powtórkach.";
    var h = '<div class="done-note">Wynik: ' + quiz.score + " / " + quiz.qs.length + " (" + pct + "%). " + msg + '</div>';
    if (quiz.wrong.length) {
      h += '<div class="section-title"><h3 style="margin:0">Do zapamiętania</h3></div>';
      quiz.wrong.forEach(function (q) {
        h += '<div class="card tight"><p class="rightline"><b>&#10003;</b><span>' + esc(q.answer) + '</span></p><p class="why">' + esc(q.why) + '</p></div>';
      });
    }
    h += '<div class="row" style="margin-top:12px">' +
      '<button class="btn slim" type="button" id="startQuiz">Jeszcze raz</button>' +
      '<button class="btn slim ghost" type="button" data-tab-go="review">Przejdź do powtórek</button>' +
      '</div>';
    box.innerHTML = h;
    document.getElementById("startQuiz").addEventListener("click", startQuiz);
    wireCommon();
  }

  /* ------------------------- powtórki ------------------------- */
  var session = null;

  function renderReview() {
    ensureDay();
    var due = dueList();
    if (!due.length) {
      view.innerHTML = '<div class="section-title"><h1>Powtórki</h1></div>' +
        '<div class="card empty"><span class="big">&#127881;</span>Na dziś nic do powtórki.<br>' +
        '<span class="small">Nowe słowa wracają dzień po nauce, a potem w coraz większych odstępach (1, 2, 4, 8, 16, 32, 60 dni).</span></div>' +
        (state.issued.length ? '<button class="btn block" type="button" id="freeReview">Powtórz losowe 10 słów mimo to</button>' : '');
      var fr = document.getElementById("freeReview");
      if (fr) fr.addEventListener("click", function () {
        session = { items: shuffle(state.issued).slice(0, 10), at: 0, ok: 0, free: true };
        renderCard();
      });
      return;
    }
    session = { items: shuffle(due), at: 0, ok: 0, free: false };
    renderCard();
  }

  function renderCard() {
    if (session.at >= session.items.length) {
      var pct = Math.round(session.ok / session.items.length * 100);
      view.innerHTML = '<div class="section-title"><h1>Powtórki</h1></div>' +
        '<div class="card"><div class="done-note">Powtórka skończona: ' + session.ok + ' / ' + session.items.length + ' (' + pct + '%).</div>' +
        '<p class="small muted" style="margin-top:10px">Słowa, których nie pamiętałeś, wrócą jutro. Reszta - później.</p>' +
        '<div class="row"><button class="btn slim" type="button" data-tab-go="review">Sprawdź, czy zostało coś na dziś</button>' +
        '<button class="btn slim ghost" type="button" data-tab-go="today">Wróć do lekcji</button></div></div>';
      refreshChrome();
      wireCommon();
      return;
    }
    var idx = session.items[session.at];
    var w = VOCAB[idx];
    var c = state.srs[idx] || { box: 1 };
    var pct = Math.round(session.at / session.items.length * 100);

    view.innerHTML = '<div class="section-title"><h1>Powtórki</h1><small>' +
        (session.at + 1) + " z " + session.items.length + ' &middot; pudełko ' + c.box + '/' + INTERVALS.length + '</small></div>' +
      '<div class="progressline"><i style="width:' + pct + '%"></i></div>' +
      '<article class="card center">' +
        '<div class="word-en" style="font-size:1.6rem">' + esc(w.w) + '</div>' +
        '<div class="ipa">' + esc(w.ipa || "") + '</div>' +
        '<div class="row" style="justify-content:center;margin-top:10px">' +
          '<button class="iconbtn" type="button" data-speak="' + esc(w.w) + '" aria-label="Przeczytaj na głos">&#128266;</button>' +
        '</div>' +
        '<div id="answerPart" hidden style="margin-top:14px;text-align:left">' + wordBody(w) + '</div>' +
        '<div id="flipRow" style="margin-top:16px"><button class="btn primary block" type="button" id="flip">Pokaż znaczenie</button></div>' +
        '<div id="gradeRow" hidden style="margin-top:16px">' +
          '<div class="row"><button class="btn bad" style="flex:1" type="button" data-grade="0">Nie pamiętam</button>' +
          '<button class="btn good" style="flex:1" type="button" data-grade="1">Wiem</button></div>' +
        '</div>' +
      '</article>';

    document.getElementById("flip").addEventListener("click", function () {
      document.getElementById("answerPart").hidden = false;
      document.getElementById("flipRow").hidden = true;
      document.getElementById("gradeRow").hidden = false;
      speak(w.w);
    });
    view.querySelectorAll("[data-grade]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ok = b.getAttribute("data-grade") === "1";
        if (!session.free) grade(idx, ok); else grade(idx, ok);
        if (ok) session.ok++;
        session.at++;
        renderCard();
      });
    });
    wireCommon();
  }

  /* ------------------------- zwroty ------------------------- */
  var phraseFilter = "wszystkie";

  function renderPhrases() {
    var cats = ["wszystkie"];
    PATTERNS.forEach(function (p) { if (cats.indexOf(p.cat) < 0) cats.push(p.cat); });
    var h = '<div class="section-title"><h1>Formy wypowiedzi</h1><small>' + PATTERNS.length + ' wzorców</small></div>' +
      '<p class="small muted">Gotowe konstrukcje do maili, spotkań i rozmów. Ucz się ich całymi blokami - tak mówią native speakerzy.</p>' +
      '<div class="chips">' + cats.map(function (c) {
        return '<button class="chip' + (c === phraseFilter ? " is-on" : "") + '" type="button" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join("") + '</div>';

    PATTERNS.forEach(function (p, i) {
      if (phraseFilter !== "wszystkie" && p.cat !== phraseFilter) return;
      h += '<details><summary>' + esc(p.title) + '<br><span class="small muted" style="font-weight:400">' + esc(p.cat) + '</span></summary>' +
        '<div class="inner">' + patternCard(i, false).replace('<article class="card">', '<div>').replace(/<\/article>$/, "</div>") +
        '<p class="small muted"><b>Zadanie:</b> ' + esc(p.task) + '<br><b>Wzór:</b> ' + esc(p.model) + '</p>' +
        '</div></details>';
    });
    view.innerHTML = h;
    view.querySelectorAll("[data-cat]").forEach(function (b) {
      b.addEventListener("click", function () { phraseFilter = b.getAttribute("data-cat"); renderPhrases(); });
    });
    wireCommon();
  }

  /* ------------------------- błędy ------------------------- */
  var mistakeFilter = "wszystkie";
  var mQuiz = null;

  function renderMistakes() {
    if (mQuiz) return renderMistakeQuiz();
    var cats = ["wszystkie"];
    MISTAKES.forEach(function (m) { if (cats.indexOf(m.cat) < 0) cats.push(m.cat); });
    var h = '<div class="section-title"><h1>Typowe błędy</h1><small>' + MISTAKES.length + ' pułapek</small></div>' +
      '<p class="small muted">Kalki z polskiego, false friends i gramatyka, na której najczęściej potykają się Polacy.</p>' +
      '<button class="btn primary block" type="button" id="mStart" style="margin-bottom:14px">Ćwiczenie: 10 pytań</button>' +
      '<div class="chips">' + cats.map(function (c) {
        return '<button class="chip' + (c === mistakeFilter ? " is-on" : "") + '" type="button" data-mcat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join("") + '</div>';
    MISTAKES.forEach(function (m, i) {
      if (mistakeFilter !== "wszystkie" && m.cat !== mistakeFilter) return;
      h += mistakeCard(i);
    });
    view.innerHTML = h;
    view.querySelectorAll("[data-mcat]").forEach(function (b) {
      b.addEventListener("click", function () { mistakeFilter = b.getAttribute("data-mcat"); renderMistakes(); });
    });
    document.getElementById("mStart").addEventListener("click", function () {
      var pick = shuffle(MISTAKES.map(function (_, i) { return i; })).slice(0, 10);
      mQuiz = { items: pick, at: 0, score: 0, opts: null };
      renderMistakeQuiz();
    });
    wireCommon();
  }

  function renderMistakeQuiz() {
    if (mQuiz.at >= mQuiz.items.length) {
      var pct = Math.round(mQuiz.score / mQuiz.items.length * 100);
      view.innerHTML = '<div class="section-title"><h1>Ćwiczenie z błędów</h1></div>' +
        '<div class="card"><div class="done-note">Wynik: ' + mQuiz.score + ' / ' + mQuiz.items.length + ' (' + pct + '%).</div>' +
        '<div class="row" style="margin-top:12px"><button class="btn slim" type="button" id="mAgain">Jeszcze raz</button>' +
        '<button class="btn slim ghost" type="button" id="mBack">Wróć do listy</button></div></div>';
      document.getElementById("mAgain").addEventListener("click", function () {
        mQuiz = { items: shuffle(MISTAKES.map(function (_, i) { return i; })).slice(0, 10), at: 0, score: 0, opts: null };
        renderMistakeQuiz();
      });
      document.getElementById("mBack").addEventListener("click", function () { mQuiz = null; renderMistakes(); });
      return;
    }
    var m = MISTAKES[mQuiz.items[mQuiz.at]];
    if (!mQuiz.opts) mQuiz.opts = shuffle([m.right, m.wrong]);
    var opts = mQuiz.opts;
    var pct = Math.round(mQuiz.at / mQuiz.items.length * 100);
    view.innerHTML = '<div class="section-title"><h1>Ćwiczenie z błędów</h1><small>' + (mQuiz.at + 1) + ' z ' + mQuiz.items.length + '</small></div>' +
      '<div class="progressline"><i style="width:' + pct + '%"></i></div>' +
      '<div class="card"><p class="q">Która wersja jest poprawna?</p><div id="mOpts">' +
      opts.map(function (o, i) { return '<button class="opt" type="button" data-mopt="' + i + '">' + esc(o) + '</button>'; }).join("") +
      '</div><div id="mFeedback"></div></div>';

    view.querySelectorAll("[data-mopt]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.getAttribute("data-mopt");
        var ok = opts[i] === m.right;
        if (ok) mQuiz.score++;
        view.querySelectorAll("[data-mopt]").forEach(function (x, n) {
          x.disabled = true;
          if (opts[n] === m.right) x.classList.add("is-right");
          else if (n === i) x.classList.add("is-wrong");
        });
        document.getElementById("mFeedback").innerHTML =
          '<div class="feedback ' + (ok ? "ok" : "no") + '"><strong>' + (ok ? "Dobrze!" : "Poprawnie: " + esc(m.right)) + '</strong>' + esc(m.why) + '</div>' +
          '<button class="btn primary block" type="button" id="mNext" style="margin-top:10px">Dalej</button>';
        document.getElementById("mNext").addEventListener("click", function () {
          mQuiz.at++; mQuiz.opts = null; renderMistakeQuiz();
        });
      });
    });
  }

  /* ------------------------- postęp ------------------------- */
  var searchTerm = "";

  function renderProgress() {
    ensureDay();
    var boxes = [0, 0, 0, 0, 0, 0, 0];
    for (var i in state.srs) boxes[state.srs[i].box - 1]++;
    var inSrs = Object.keys(state.srs).length;
    var due = dueList().length;
    var left = Math.max(VOCAB.length - state.issued.length, 0);

    var h = '<div class="section-title"><h1>Postęp</h1><small>' + esc(prettyDate(today())) + '</small></div>' +
      '<div class="stats">' +
        stat(visibleStreak(), plural(visibleStreak(), "dzień z rzędu", "dni z rzędu", "dni z rzędu")) +
        stat(state.daysDone.length, plural(state.daysDone.length, "ukończona lekcja", "ukończone lekcje", "ukończonych lekcji")) +
        stat(state.issued.length, "poznanych słów") +
        stat(mastered(), "dobrze utrwalonych") +
      '</div>';

    h += '<div class="section-title"><h2>Rozkład powtórek</h2><small>' + due + ' na dziś</small></div><div class="card bars">';
    for (var b = 0; b < boxes.length; b++) {
      var w = inSrs ? Math.round(boxes[b] / inSrs * 100) : 0;
      h += '<div class="bar"><span class="lbl">co ' + INTERVALS[b] + ' ' + plural(INTERVALS[b], "dzień", "dni", "dni") + '</span>' +
        '<span class="track"><i style="width:' + w + '%"></i></span><span class="num">' + boxes[b] + '</span></div>';
    }
    h += '<p class="small muted" style="margin:8px 0 0">W bazie zostało jeszcze ' + left + ' ' + plural(left, "nowe słowo", "nowe słowa", "nowych słów") + '.</p></div>';

    h += '<div class="section-title"><h2>Twoje słowa</h2><small>' + state.issued.length + '</small></div>' +
      '<div class="card"><input type="search" id="wSearch" placeholder="Szukaj po angielsku lub po polsku..." value="' + esc(searchTerm) + '">' +
      '<ul class="list" id="wList">' + wordListHtml() + '</ul></div>';

    h += '<div class="section-title"><h2>Ustawienia</h2></div><div class="card stack">' +
      '<label class="small" style="font-weight:600" for="wpd">Nowych słów dziennie</label>' +
      '<select id="wpd">' + [3, 5, 7, 10].map(function (n) {
        return '<option value="' + n + '"' + (state.wordsPerDay === n ? " selected" : "") + '>' + n + '</option>';
      }).join("") + '</select>' +
      '<p class="small muted" style="margin:0">Zmiana zadziała od następnego dnia.</p>' +
      '<div class="row"><button class="btn slim" type="button" id="expBtn">Kopia zapasowa</button>' +
      '<button class="btn slim ghost" type="button" id="resetBtn">Wyczyść postęp</button></div>' +
      '<div id="backupBox" class="stack" hidden></div>' +
      '<p class="small muted" style="margin:0">Postęp zapisuje się tylko na tym urządzeniu, w tej przeglądarce.</p>' +
      '</div>';

    view.innerHTML = h;

    document.getElementById("wpd").addEventListener("change", function (e) {
      state.wordsPerDay = +e.target.value; save();
    });
    document.getElementById("wSearch").addEventListener("input", function (e) {
      searchTerm = e.target.value;
      document.getElementById("wList").innerHTML = wordListHtml();
    });
    document.getElementById("expBtn").addEventListener("click", exportProgress);
    document.getElementById("resetBtn").addEventListener("click", function () {
      if (confirm("Usunąć cały postęp (serię, powtórki, poznane słowa)?")) {
        state = freshState(); save(); ensureDay(); go("today");
      }
    });
    wireCommon();
  }

  function stat(n, label) {
    return '<div class="stat"><b>' + n + '</b><span>' + esc(label) + '</span></div>';
  }
  function wordListHtml() {
    var q = searchTerm.trim().toLowerCase();
    var items = state.issued.slice().reverse().filter(function (idx) {
      var w = VOCAB[idx];
      if (!w) return false;
      if (!q) return true;
      return (w.w + " " + w.pl).toLowerCase().indexOf(q) >= 0;
    });
    if (!items.length) return '<li class="muted small">Brak wyników.</li>';
    return items.slice(0, 200).map(function (idx) {
      var w = VOCAB[idx], c = state.srs[idx];
      return '<li><span><b>' + esc(w.w) + '</b>' + (c ? ' <span class="small muted">(' + c.box + '/' + INTERVALS.length + ')</span>' : '') +
        '</span><span class="l-pl">' + esc(w.pl) + '</span></li>';
    }).join("");
  }
  /* Kopia zapasowa jako tekst, a nie plik: pobieranie plików bywa zablokowane
     (podgląd w Artifactach, część przeglądarek mobilnych), a tekst da się skopiować wszędzie. */
  function exportProgress() {
    var box = document.getElementById("backupBox");
    if (!box) return;
    box.hidden = false;
    box.innerHTML =
      '<label class="small" style="font-weight:600" for="backupText">Twój postęp jako tekst - zapisz go w notatkach lub w pliku</label>' +
      '<textarea id="backupText" style="min-height:110px;font-size:.78rem">' + esc(JSON.stringify(state)) + '</textarea>' +
      '<div class="row"><button class="btn slim" type="button" id="copyBackup">Kopiuj</button>' +
      '<button class="btn slim ghost" type="button" id="importBackup">Przywróć z tego tekstu</button></div>' +
      '<p class="small muted" id="backupMsg" style="margin:0">Aby przenieść postęp na inne urządzenie, wklej tu zapisany tekst i kliknij Przywróć.</p>';

    var msg = document.getElementById("backupMsg");
    document.getElementById("copyBackup").addEventListener("click", function () {
      var ta = document.getElementById("backupText");
      ta.select();
      var done = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(function () {
          msg.textContent = "Skopiowane do schowka.";
        }).catch(function () {
          msg.textContent = "Nie udało się skopiować automatycznie - zaznacz tekst i skopiuj ręcznie.";
        });
        done = true;
      }
      if (!done) msg.textContent = "Zaznacz tekst i skopiuj ręcznie.";
    });
    document.getElementById("importBackup").addEventListener("click", function () {
      try {
        var incoming = JSON.parse(document.getElementById("backupText").value);
        if (!incoming || typeof incoming !== "object" || !incoming.srs || !incoming.order) throw new Error("zły format");
        var f = freshState();
        for (var k in f) if (!(k in incoming)) incoming[k] = f[k];
        state = incoming;
        save();
        ensureDay();
        go("progress");
      } catch (e) {
        msg.textContent = "To nie wygląda na kopię postępu - sprawdź, czy wklejony tekst jest kompletny.";
      }
    });
  }

  /* ------------------------- wspólne zdarzenia ------------------------- */
  function wireCommon() {
    view.querySelectorAll("[data-speak]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); speak(b.getAttribute("data-speak")); });
    });
    view.querySelectorAll("[data-reveal]").forEach(function (b) {
      b.addEventListener("click", function () {
        var card = b.closest("[data-word]");
        card.querySelector(".hidden-part").hidden = false;
        b.parentNode.hidden = true;
        speak(VOCAB[+b.getAttribute("data-reveal")].w);
      });
    });
    view.querySelectorAll("[data-tab-go]").forEach(function (b) {
      b.addEventListener("click", function () { go(b.getAttribute("data-tab-go")); });
    });
    var t = view.querySelector("[data-task]");
    if (t) t.addEventListener("input", function () {
      state.tasks[+t.getAttribute("data-task")] = t.value; save();
    });
    var sm = document.getElementById("showModel");
    if (sm) sm.addEventListener("click", function () {
      document.getElementById("modelAns").hidden = false;
      sm.disabled = true;
    });
  }

  /* ------------------------- nawigacja ------------------------- */
  var VIEWS = { today: renderToday, review: renderReview, phrases: renderPhrases, mistakes: renderMistakes, progress: renderProgress };
  var current = "today";

  function go(tab) {
    if (!VIEWS[tab]) tab = "today";
    current = tab;
    if (tab !== "mistakes") mQuiz = null;
    document.querySelectorAll("#tabbar button").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-tab") === tab);
    });
    VIEWS[tab]();
    refreshChrome();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function refreshChrome() {
    document.getElementById("streakCount").textContent = visibleStreak();
    document.getElementById("dateLabel").textContent = prettyDate(today());
    var n = dueList().length;
    var badge = document.getElementById("dueBadge");
    badge.textContent = n;
    badge.hidden = n === 0;
  }

  /* ------------------------- start ------------------------- */
  function init() {
    state = load();
    ensureDay();
    document.querySelectorAll("#tabbar button").forEach(function (b) {
      b.addEventListener("click", function () { go(b.getAttribute("data-tab")); });
    });
    document.getElementById("streakBtn").addEventListener("click", function () { go("progress"); });
    go("today");

    // nowy dzień, gdy telefon wraca z uśpienia
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state.day !== today()) { ensureDay(); go("today"); }
    });

    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () { });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
