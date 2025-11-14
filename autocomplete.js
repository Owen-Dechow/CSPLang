// @ts-check

const words = [
    ["PROCEDURE", "PROCEDURE"],
    ["FOR", "FOR"],
    ["EACH", "EACH"],
    ["IN", "IN"],
    ["IF", "IF"],
    ["ELSE", "ELSE"],
    ["RETURN", "RETURN"],
    ["MOD", "MOD"],
    ["NOT", "NOT"],
    ["AND", "AND"],
    ["OR", "OR"],
    ["REPEAT", "REPEAT"],
    ["TIMES", "TIMES"],
    ["UNTIL", "UNTIL"],
    ["ass", "←"],
    ["neq", "≠"],
    ["lteq", "≤"],
    ["qteq", "≥"],
];

/**
 * @param {string} a
 * @param {string} b
 */
function score(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();

    const sanitize = (/** @type {string} */ str) => str.replace(/[^a-z0-9]/gi, "");
    a = sanitize(a);
    b = sanitize(b);

    const lenA = a.length;
    const lenB = b.length;

    if (a === b) return 1.5;
    if (lenA === 0 || lenB === 0) return 0;

    let prev = Array(lenB + 1).fill(0);
    let curr = Array(lenB + 1).fill(0);

    for (let j = 0; j <= lenB; j++) prev[j] = j;

    for (let i = 1; i <= lenA; i++) {
        curr[0] = i;
        for (let j = 1; j <= lenB; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost
            );
        }
        [prev, curr] = [curr, prev];
    }

    const distance = prev[lenB];
    const maxLen = Math.max(lenA, lenB);

    let similarity = 1 - distance / maxLen;
    if (a.startsWith(b)) similarity += 0.5;

    return similarity;
}

/**
 * Position the suggestions box at the caret location inside a textarea.
 * Flips up or down depending on available space in the parent.
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement} suggestionsBox
 */
function positionSuggestionsBox(textarea, suggestionsBox) {
    const rect = textarea.getBoundingClientRect();

    // Create a hidden div that copies textarea styles
    const div = document.createElement("div");
    const style = getComputedStyle(textarea);
    for (const prop of style) {
        div.style[prop] = style[prop];
    }

    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.whiteSpace = "pre-wrap";
    div.style.overflow = "auto";
    div.style.width = rect.width + "px";

    const beforeCaret = textarea.value.substring(0, textarea.selectionStart);
    const afterCaret = textarea.value.substring(textarea.selectionStart);

    const escape = (/** @type {string} */ str) =>
        str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    div.innerHTML = escape(beforeCaret);

    const span = document.createElement("span");
    span.textContent = "\u200b"; // zero-width space
    div.appendChild(span);
    div.appendChild(document.createTextNode(afterCaret));

    document.body.appendChild(div);

    const spanRect = span.getBoundingClientRect();

    // @ts-ignore
    const parentRect = textarea.parentElement.getBoundingClientRect();

    // Default position: below caret
    suggestionsBox.style.position = "absolute";
    suggestionsBox.style.left = spanRect.left + 2 + "px";

    // Check available space
    const spaceBelow = parentRect.bottom - spanRect.bottom;
    const spaceAbove = spanRect.top - parentRect.top;

    if (spaceBelow < 300 && spaceAbove > spaceBelow) {
        suggestionsBox.style.top = spanRect.top - suggestionsBox.offsetHeight - 2 + "px";
    } else {
        suggestionsBox.style.top = spanRect.bottom + 2 + "px";
    }

    document.body.removeChild(div);

}

const maxOptions = 20;

/**
 * @param {string} key
 */
export function autoCompleteSendKey(key) {
    if (completions.length) {
        if (key == "Tab") {
            completions[completeTarget].callback();
            return true;
        }

        if (key == "ArrowDown") {
            completions[completeTarget].classList.remove("complete-target");
            completeTarget += 1;

            if (completeTarget >= completions.length)
                completeTarget = 0;

            completions[completeTarget].classList.add("complete-target");

            return true;
        }

        if (key == "ArrowUp") {
            completions[completeTarget].classList.remove("complete-target");
            completeTarget -= 1;

            if (completeTarget < 0)
                completeTarget = completions.length - 1;

            completions[completeTarget].classList.add("complete-target");
            return true;
        }

        if (key == "Escape" || key == "ArrowLeft" || key == "ArrowRight") {
            clearAutoCompleteBox();
        }
    }

    return false;
}

export function clearAutoCompleteBox() {
    // @ts-ignore
    document.querySelector("#suggestions").style.display = "none";
    completions = [];
}

let completeTarget = 20;
let completions = [];

// @ts-ignore
window.suggestCompletions = (/** @type {HTMLTextAreaElement} */ element) => {
    /** @type {HTMLDivElement} */
    // @ts-ignore
    const suggestionsBox = document.querySelector("#suggestions");

    const caretPos = element.selectionStart;
    const beforeCaret = element.value.slice(0, caretPos);
    const afterCaret = element.value.slice(caretPos);

    completions = [];
    completeTarget = 0;

    // Match only the last alphanumeric "word" before caret
    const match = beforeCaret.match(/([a-zA-Z0-9_]+)$/);
    const query = match ? match[0].toLowerCase() : "";

    suggestionsBox.innerHTML = "";

    suggestionsBox.removeAttribute("style");
    if (!query) {
        suggestionsBox.style.display = "none";
        return;
    };

    const localWords = words.map(([key, display]) => [key, display]);

    // Sort all words by similarity using the key
    const allWords = element.value.match(/\b[a-zA-Z0-9_]+\b/g) || [];
    allWords.forEach(w => {
        const exists = localWords.some(([key]) => key == w);
        if (!exists && !query.includes(w)) {
            localWords.push([w, w]); // add with same display form
        }
    });

    const sorted = localWords
        .map(([key, display]) => ({ key, display, score: score(key, query) }))
        .sort((a, b) => b.score - a.score);


    sorted.forEach(({ key, display }) => {
        if (completions.length < maxOptions) {
            const div = document.createElement("div");

            if (completions.length == 0)
                div.classList.add("complete-target");

            div.innerHTML = `<span>${key}</span><span>${display}</span>`;

            // @ts-ignore
            div.callback = () => {
                const newBeforeCaret = beforeCaret.replace(/([a-zA-Z0-9_]+)$/, display);
                element.value = newBeforeCaret + " " + afterCaret;
                const newCaretPos = newBeforeCaret.length + 1;
                element.focus();
                element.setSelectionRange(newCaretPos, newCaretPos);
                suggestionsBox.innerHTML = "";

                // @ts-ignore
                window.update(element);

                clearAutoCompleteBox();
            };

            completions.push(div);

            suggestionsBox.appendChild(div);
        }
    });

    positionSuggestionsBox(element, suggestionsBox);
};
