// @ts-check

/** @typedef {import("./tokens.js").TokenTypeEnum} TokenTypeEnum */

import { parseExpression } from "./expressions.js";
import { CSPError } from "./error.js";
import { TokenType, TokenStream, Token, wordTokens, operatorTokens } from "./tokens.js";
import { Assign, Conditional, ExpressionAction, For, MakeProc, RepeatN, RepeatUntil, Return } from "./action.js";
import { execute } from "./execute.js";
import { autoCompleteSendKey, clearAutoCompleteBox } from "./autocomplete.js";

const examplePrograms = {
    HelloWorld: `DISPLAY("HELLO WORLD")`,
    Empty: ``,
    CalcAverage: `PROCEDURE calculateAverage(list_of_numbers) {
    sum_of_numbers ← 0
    num_elements ← LENGTH(list_of_numbers)

    IF (num_elements = 0) {
        RETURN 0 // Handle empty list case
    }

    FOR EACH number IN list_of_numbers {
        sum_of_numbers ← sum_of_numbers + number
    }

    average ← sum_of_numbers / num_elements
    RETURN average
}

// Main program execution
numbers_list ← [10, 20, 30, 40, 50]
result_average ← calculateAverage(numbers_list)
DISPLAY("The average of the numbers is: ")
DISPLAY(result_average)

empty_list ← []
result_empty_average ← calculateAverage(empty_list)
DISPLAY("The average of an empty list is: ")
DISPLAY(result_empty_average)`,
};

document.addEventListener("DOMContentLoaded", () => {
    const code = document.querySelector("#code");

    // @ts-ignore
    code.innerHTML = examplePrograms.default;

    // @ts-ignore
    window.update(code);


    const examples = document.querySelector("#example-programs");

    Object.keys(examplePrograms).forEach(e => {
        // @ts-ignore
        if (!examples.value)
            // @ts-ignore
            examples.value = e;

        const opt = document.createElement("option");
        opt.value = e;
        opt.textContent = e;

        // @ts-ignore
        examples.append(opt);
    });

    // @ts-ignore
    window.setProgram();
});

// @ts-ignore
window.setProgram = () => {
    const code = document.querySelector("#code");
    const examples = document.querySelector("#example-programs");

    // @ts-ignore
    code.value = examplePrograms[examples.value];
    
    // @ts-ignore
    window.update(code);
};

// @ts-ignore
window.run = () => {
    // @ts-ignore
    window.clearUiTerm();

    // @ts-ignore
    const text = document.querySelector("#code").value;

    try {
        const tokens = lex(text + "\n");
        const ast = parse(new TokenStream(tokens), true);
        execute(ast);
    } catch (e) {
        console.error(e);
        e.printout(text);
    }
};

// @ts-ignore
window.clearUiTerm = () => {
    // @ts-ignore
    document.querySelector("#output").innerHTML = "";
};

// @ts-ignore
window.update = (/** @type {HTMLTextAreaElement} */ textArea) => {
    let text = textArea.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    if (text[text.length - 1] == "\n") {
        text += " ";
    }

    const rules = {
        operators: ["#66d200", /[{}()\[\],←≤≥≠=]/g],
        lt: ["#66d200", /&lt;/g],
        gt: ["#66d200", /&gt;/g],
        keyword: ["#e13166", /\b(FOR|EACH|IN|IF|ELSE|RETURN|MOD|NOT|AND|OR|REPEAT|TIMES|UNTIL|PROCEDURE)\b/g],
        builtin: ["#e88035", /\b(DISPLAY|LENGTH|INPUT|REMOVE|INSERT|APPEND)\b/g],
        bool: ["#ff00fb", /\b(true|false)\b/g],
        number: ["#149be3", /\b\d+\b/g],
        comment: ["#707070", /\/\/.*/g],
        string: ["#d7a65f", /"[^"]*"/gs],
    };

    for (const [_, [color, regex]] of Object.entries(rules)) {
        text = text.replace(regex, (/** @type {string} */ match) => {
            return `<span style='color: ${color}'>${match}</span>`;
        });
    }

    let nums = "";
    text.split("\n").forEach((_, i) => { nums += i + 1 + "\n"; });

    // @ts-ignore
    document.querySelector("#numbers").innerHTML = nums;

    // @ts-ignore
    document.querySelector("#highlighting").innerHTML = text;
};

// @ts-ignore
window.checkTab = (/** @type {HTMLTextAreaElement} */ element, /** @type {KeyboardEvent} */ event) => {
    let code = element.value;

    if (autoCompleteSendKey(event.key)) {
        event.preventDefault();
        return;
    }

    if (event.key == "Tab") {
        event.preventDefault();

        let before_tab = code.slice(0, element.selectionStart);
        let after_tab = code.slice(element.selectionEnd, element.value.length);
        let cursor_pos = element.selectionEnd + 4;

        element.value = before_tab + "    " + after_tab;

        // move cursor
        element.selectionStart = cursor_pos;
        element.selectionEnd = cursor_pos;

        // @ts-ignore
        window.update(element);
    }
};

// @ts-ignore
window.insertChar = (/** @type {string} */ ch) => {
    /** @type {HTMLTextAreaElement} */
    // @ts-ignore
    const code = document.querySelector("#code");

    const start = code.selectionStart;
    const end = code.selectionEnd;

    // Use setRangeText so Ctrl-Z works
    code.setRangeText(ch, start, end, "end");

    // Refocus the textarea
    code.focus();

    // @ts-ignore
    window.setTimeout(() => { window.update(code); }, 0);
};

// @ts-ignore
window.clickCode = () => {
    clearAutoCompleteBox();
};

const ParserState = Object.freeze({
    NONE: "NONE",
    NUMBER: "NUMBER",
    WORD: "WORD",
    OPERATOR: "OPERATOR",
    COMMENT: "COMMENT",
    STRING: "STRING",
});

/**
 * @typedef {keyof typeof ParserState} ParserStateEnum
 */

/**
 * @param {string} value
 */
function isPartialOperator(value) {
    for (const op of Object.keys(operatorTokens)) {
        if (op.startsWith(value))
            return true;
    }

    return false;
}

/**
 * @param {string} c
 */
function isAlpha(c) {
    return /^[a-zA-Z]$/.test(c) || c == "_";
}

/**
 * @param {string} c
 */
function isDigit(c) {
    return /\d/.test(c);
}

/**
 * @param {string} c
 */
function isAlphaNumeric(c) {
    return isAlpha(c) || isDigit(c);
}

/**
 * @param {string} c
 */
function getParserState(c) {
    if (isAlpha(c))
        return ParserState.WORD;
    else if (isDigit(c))
        return ParserState.NUMBER;
    else if (c == '"')
        return ParserState.STRING;
    else
        return ParserState.OPERATOR;
}

/**
 * @param {string} text
 * @returns {Token[]}
 */
function lex(text) {
    /** @type {ParserStateEnum} */
    let state = ParserState.NONE;

    let value = "";

    /** @type {Token[]} */
    let tokens = [];
    let loc = -1;

    const sendToken = (/** @type {TokenTypeEnum} */ type, /** @type {boolean} */ backstep) => {
        if (backstep)
            loc -= 1;

        tokens.push(new Token(value, type, loc));
        value = "";
        state = ParserState.NONE;
    };

    while (loc < text.length - 1) {
        loc += 1;
        const c = text[loc];

        if (state == ParserState.NONE) {
            if (/\s/.test(c)) {
                if (c == "\n") {
                    sendToken(TokenType.NL, false);
                }

                // Skip whitespace
                continue;
            }

            state = getParserState(c);
        }

        if (state == ParserState.WORD) {
            if (isAlphaNumeric(c)) {
                value += c;
            } else {
                sendToken(value in wordTokens ? wordTokens[value] : TokenType.ID, true);
            }
        } else if (state == ParserState.STRING) {
            if (c != '"' || value.length == 0) {
                value += c;
            } else {
                value += '"';
                sendToken(TokenType.STRING, false);
            }
        } else if (state == ParserState.NUMBER) {
            if (isDigit(c) || (c == "." && !value.includes("."))) {
                value += c;
            } else {
                sendToken(TokenType.NUMBER, true);
            }
        } else if (state == ParserState.COMMENT) {
            if (c != "\n") {
                value += c;
            } else {
                sendToken(TokenType.COMMENT, false);
            }
        } else if (state == ParserState.OPERATOR) {
            if (isPartialOperator(value + c)) {
                value += c;
            } else {
                const op = operatorTokens[value];

                if (op == TokenType.COMMENT) {
                    value += c;
                    state = ParserState.COMMENT;
                }
                else if (value.length == 0) {
                    value += c;
                    throw new CSPError(loc, loc + 1, `Unknown token "${value}".`);
                }
                else {
                    sendToken(op, true);
                }
            }
        }
    }

    sendToken(TokenType.EOF, false);
    return tokens;
}

/**
 * @param {TokenStream} ts
 */
function parseProcedure(ts) {
    const name = ts.takeSigOfType(TokenType.ID);
    ts.takeSigOfType(TokenType.OPEN_PAREN);
    const args = [];

    while (true) {
        const t = ts.nextSig();

        if (t.type == TokenType.CLOSE_PAREN) {
            break;
        } else if (t.type == TokenType.ID) {
            args.push(t);
        } else {
            throw CSPError.invalidToken(TokenType.ID, t);
        }

        const following = ts.nextSig();
        if (following.type == TokenType.CLOSE_PAREN) {
            break;
        } else if (following.type != TokenType.COMMA) {
            throw CSPError.invalidToken(TokenType.CLOSE_PAREN, following);
        }
    }

    ts.takeSigOfType(TokenType.OPEN_BLOCK);

    const block = parse(ts, false);

    return new MakeProc(name, args, block);
}

/**
 * @param {TokenStream} ts
 */
function parseConditional(ts) {
    ts.takeSigOfType(TokenType.OPEN_PAREN);

    const conditional = parseExpression(ts);
    ts.takeSigOfType(TokenType.CLOSE_PAREN);
    ts.takeSigOfType(TokenType.OPEN_BLOCK);

    const block = parse(ts, false);

    const elseToken = ts.nextSig();
    let elseBlock = null;
    if (elseToken.type == TokenType.ELSE) {
        ts.takeSigOfType(TokenType.OPEN_BLOCK);
        elseBlock = parse(ts, false);
    } else {
        ts.back();
    }

    return new Conditional(conditional, block, elseBlock);
}

/**
 * @param {TokenStream} ts
 */
function parseRepeatN(ts) {
    const n = parseExpression(ts);
    ts.takeSigOfType(TokenType.TIMES);
    ts.takeSigOfType(TokenType.OPEN_BLOCK);
    const block = parse(ts, false);

    return new RepeatN(n, block);
}

/**
 * @param {TokenStream} ts
 */
function parseRepeatUntil(ts) {
    const conditional = parseExpression(ts);
    ts.takeSigOfType(TokenType.OPEN_BLOCK);
    const block = parse(ts, false);

    return new RepeatUntil(conditional, block);
}

/**
 * @param {TokenStream} ts
 */
function parseRepeat(ts) {
    const t = ts.nextSig();

    if (t.type == TokenType.UNTIL)
        return parseRepeatUntil(ts);
    else {
        ts.back();
        return parseRepeatN(ts);
    }

}

/**
 * @param {TokenStream} ts
 */
function parseFor(ts) {
    ts.takeSigOfType(TokenType.EACH);

    const item = ts.takeSigOfType(TokenType.ID);
    ts.takeSigOfType(TokenType.IN);

    const list = parseExpression(ts);
    ts.takeSigOfType(TokenType.OPEN_BLOCK);
    const block = parse(ts, false);

    return new For(item, list, block);
}

/**
 * @param {TokenStream} ts
 */
function parseReturn(ts) {
    return new Return(parseExpression(ts));
}


/**
 * @param {TokenStream} ts
 */
function parseAssign(ts) {
    const variable = ts.takeSigOfType(TokenType.ID);
    ts.takeSigOfType(TokenType.ASSIGN);

    const expression = parseExpression(ts);

    return new Assign(variable, expression);
}

/**
 * @param {TokenStream} ts
 */
function parseIdLeadLine(ts) {
    const t = ts.nextSig();
    ts.back(); ts.back();

    if (t.type == TokenType.ASSIGN) {
        return parseAssign(ts);
    } else {
        return new ExpressionAction(parseExpression(ts));
    }
}

/**
 * @param {TokenStream} ts
 * @param {boolean} rootBlock
 */
function parse(ts, rootBlock) {
    let steps = [];

    while (ts.jumpToSig().type != TokenType.EOF) {
        let t = ts.next();

        if (t.type == TokenType.CLOSE_BLOCK && !rootBlock) {
            break;
        } else if (t.type == TokenType.PROCEDURE) {
            steps.push(parseProcedure(ts));
        } else if (t.type == TokenType.IF) {
            steps.push(parseConditional(ts));
        } else if (t.type == TokenType.REPEAT) {
            steps.push(parseRepeat(ts));
        } else if (t.type == TokenType.FOR) {
            steps.push(parseFor(ts));
        } else if (t.type == TokenType.RETURN) {
            steps.push(parseReturn(ts));

            if (rootBlock) {
                throw CSPError.fromRange([t.loc - t.value.length, t.loc], `May not return form global space.`);
            }
        } else if (t.type == TokenType.ID) {
            steps.push(parseIdLeadLine(ts));
        } else {
            throw CSPError.invalidLine(t);
        }

    }

    ts.back();
    if (ts.next().type == TokenType.EOF && !rootBlock) {
        ts.back();
        throw CSPError.invalidToken(TokenType.CLOSE_BLOCK, ts.next());
    }

    return steps;
}
