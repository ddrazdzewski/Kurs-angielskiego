#!/usr/bin/env node
/* Scala index.html, styl i skrypty w jeden samodzielny plik HTML.
   Przydatne, gdy chcesz wysłać stronę mailem, wrzucić na dysk telefonu
   albo opublikować w miejscu, które przyjmuje tylko jeden plik.

   Użycie:  node tools/build-single-file.js [plik-wyjsciowy.html]
*/
var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var OUT = process.argv[2] || path.join(ROOT, "angielski-b1-b2.html");
function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }

var html = read("index.html");
var body = html.split("<body>")[1].split("</body>")[0]
  .replace(/\s*<script src="[^"]*"><\/script>/g, "")
  .trim();

// w jednym pliku nie ma czego cache'ować - service worker wypada
var app = read("js/app.js").replace(/\n\s*if \("serviceWorker" in navigator[\s\S]*?\n\s*}\n/, "\n");
if (app.indexOf("serviceWorker") >= 0) {
  console.error("Nie udało się usunąć rejestracji service workera - sprawdź js/app.js.");
  process.exit(1);
}

var parts = [
  "<!DOCTYPE html>",
  '<html lang="pl"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta name="theme-color" content="#4f46e5">',
  "<title>Angielski B1-B2</title>",
  "<style>", read("css/style.css").trim(), "</style>",
  "</head><body>",
  body,
  "<script>", read("js/data/words.js").trim(), "</script>",
  "<script>", read("js/data/patterns.js").trim(), "</script>",
  "<script>", read("js/data/mistakes.js").trim(), "</script>",
  "<script>", app.trim(), "</script>",
  "</body></html>"
];

var out = parts.join("\n");
fs.writeFileSync(OUT, out);
console.log("Zapisano " + OUT + " (" + Math.round(out.length / 1024) + " kB)");
