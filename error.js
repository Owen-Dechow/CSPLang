// @ts-check

/** @typedef {import("./tokens").TokenTypeEnum} TokenTypeEnum */

import { Expression } from "./expressionParsing.js";
import { Token } from "./tokens.js";

export class Error {
    /**
     * @param {number} start 
     * @param {number} end 
     * @param {string} msg 
     */
    constructor(start, end, msg) {
        /** @type {number} */
        this.start = start;

        /** @type {number} */
        this.end = end;

        /** @type {string} */
        this.msg = msg;
    }

    /** @param {string} prog */
    printout(prog) {
        const SHOW_ON_SIDES = 2;

        let start = this.start;
        let newlinesFound = 0;
        while (start > 0 && newlinesFound < SHOW_ON_SIDES + 1) {
            start -= 1;

            if (prog[start] == "\n")
                newlinesFound += 1;
        }

        let errorLine = newlinesFound;
        let lineScanner = start;
        while (lineScanner > 0) {
            lineScanner -= 1;
            if (prog[lineScanner] == "\n")
                errorLine += 1;
        }

        let end = this.end;
        newlinesFound = 0;
        while (end < prog.length - 1 && newlinesFound < SHOW_ON_SIDES) {
            end += 1;

            if (prog[end] == "\n")
                newlinesFound += 1;
        }

        const left = cleaned(prog.slice(start, this.start));
        const err = cleaned(prog.slice(this.start, this.end));
        const right = cleaned(prog.slice(this.end, end));

        const msg = `Error (line ${errorLine + 1}): ${this.msg}${left.startsWith("\n") ? "" : "\n"}<span class="err">${left}<span class="err">${err}</span>${right}</span>`;

        const output = document.querySelector("#output");
        if (output)
            output.innerHTML = msg;
    }

    /**
     * @param {TokenTypeEnum} expected 
     * @param {Token} found 
     */
    static invalidToken(expected, found) {
        const start = found.loc - found.value.length;
        const end = found.loc;
        const msg = `Expected token of type "${expected}" found "${found.type}".`;

        return new Error(start, end, msg);
    }

    /** @param {Token} found */
    static invalidLine(found) {
        const start = found.loc - found.value.length;
        const end = found.loc;
        const msg = `Lines may not begin with token of type "${found.type}".`;

        return new Error(start, end, msg);
    }


    /**
     * @param {Token} found
     */
    static expectedExpression(found) {
        const start = found.loc - found.value.length;
        const end = found.loc;
        const msg = `Expected expression; found token of type "${found.type}".`;

        return new Error(start, end, msg);
    }

    /**
     * @param {string} msg
     * @param {Expression} expression
     */
    static fromExpression(msg, expression) {
        const loc = expression.getLocRange();
        return new Error(loc[0], loc[1], msg);
    }
}

/** @param {string} text */
function cleaned(text) {
    return text.replace("&", "&amp;").replace(">", "&gt;").replace("<", "&lt;");
}
