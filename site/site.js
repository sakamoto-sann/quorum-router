const root = document.documentElement;
const languageButtons = [...document.querySelectorAll("[data-language]")];

function setLanguage(language) {
  const next = language === "ja" ? "ja" : "en";
  root.lang = next;
  root.dataset.language = next;
  for (const button of languageButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.language === next),
    );
  }
  try {
    localStorage.setItem("quorum-router-language", next);
  } catch {
    // Storage can be unavailable in private browsing. The switch still works.
  }
}

let initialLanguage = "en";
try {
  initialLanguage = localStorage.getItem("quorum-router-language") ||
    (navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en");
} catch {
  initialLanguage = navigator.language.toLowerCase().startsWith("ja")
    ? "ja"
    : "en";
}
setLanguage(initialLanguage);

for (const button of languageButtons) {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
}

for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const value = button.dataset.copy || "";
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    button.classList.add("copied");
    const labels = button.querySelectorAll("[data-copy-label]");
    for (const label of labels) {
      label.dataset.originalText = label.textContent;
      label.textContent = label.dataset.lang === "ja" ? "完了" : "Copied";
    }
    globalThis.setTimeout(() => {
      button.classList.remove("copied");
      for (const label of labels) {
        label.textContent = label.dataset.originalText || label.textContent;
      }
    }, 1600);
  });
}

const header = document.querySelector("[data-header]");
function updateHeader() {
  header?.classList.toggle("is-scrolled", globalThis.scrollY > 24);
}
updateHeader();
globalThis.addEventListener("scroll", updateHeader, { passive: true });

document.querySelector("[data-year]").textContent = String(
  new Date().getFullYear(),
);
