// @ts-check

/** @typedef {import("./tokens.js").TokenTypeEnum} TokenTypeEnum */

import { Expression, parseExpression } from "./expressionParsing.js";
import { Action } from "./action.js";
import { Error } from "./error.js";
import { TokenType, TokenStream, Token, wordTokens, operatorTokens } from "./tokens.js";

// @ts-ignore
window.run = () => {
    // @ts-ignore
    document.querySelector("#output").innerHTML = "";

    // @ts-ignore
    const text = document.querySelector("#code").value;
    const tokens = lex(text + "\n");

    try {
        const ast = parse(new TokenStream(tokens), true);
        console.log(ast);
    } catch (e) {
        e.printout(text);
        console.error(e);
    }
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
                    throw "E"; // TODO
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

class MakeProc extends Action {
    /**
     * @param {Token} name
     * @param {any[]} args
     * @param {Action[]} block
     */
    constructor(name, args, block) {
        super();

        /** @type {Token} */
        this.name = name;

        /** @type {Token[]} */
        this.args = args;


        /** @type {Action[]} */
        this.block = block;
    }
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
            throw Error.invalidToken(TokenType.ID, t);
        }

        const following = ts.nextSig();
        if (following.type == TokenType.CLOSE_PAREN) {
            break;
        } else if (following.type != TokenType.COMMA) {
            throw Error.invalidToken(TokenType.CLOSE_PAREN, following);
        }
    }

    ts.takeSigOfType(TokenType.OPEN_BLOCK);

    const block = parse(ts, false);

    return new MakeProc(name, args, block);
}

class Conditional extends Action {
    /**
     * @param {Expression} conditional
     * @param {Token[]} block
     * @param {Token[]} elseBlock
     */
    constructor(conditional, block, elseBlock) {
        super();

        /** @type {Expression} */
        this.conditional = conditional;

        /** @type {Token[]} */
        this.block = block;

        /** @type {Token[]} */
        this.elseBlock = elseBlock;
    }
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

class RepeatN extends Action {
    /**
     * @param {Expression} n
     * @param {Token[]} block
     */
    constructor(n, block) {
        super();
        this.n = n;
        this.block = block;
    }


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

class RepeatUntil extends Action {
    /**
     * @param {Expression} conditional
     * @param {Token[]} block
     */
    constructor(conditional, block) {
        super();

        /** @type {Expression} */
        this.conditional = conditional;

        /** @type {Token[]} */
        this.block = block;
    }


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
    ts.back();

    if (t.type == TokenType.REPEAT)
        return parseRepeatUntil(ts);
    else
        return parseRepeatN(ts);

}

class For extends Action {
    /**
     * @param {Token} item
     * @param {Expression} list
     * @param {Token[]} block
     */
    constructor(item, list, block) {
        super();

        /** @type {Token} */
        this.item = item;

        /** @type {Expression} */
        this.list = list;

        /** @type {Token[]} */
        this.block = block;
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

class Return extends Action {
    /**
     * @param {Expression} value
     */
    constructor(value) {
        super();

        /** @type {Expression} */
        this.value = value;
    }


}

/**
 * @param {TokenStream} ts
 */
function parseReturn(ts) {
    return new Return(parseExpression(ts));
}

class Assign extends Action {
    /**
     * @param {Token} variable
     * @param {Expression} expression
     */
    constructor(variable, expression) {
        super();

        /** @type {Token} */
        this.variable = variable;

        /** @type {Expression} */
        this.expression = expression;
    }


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
        return parseExpression(ts);
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
        } else if (t.type == TokenType.ID) {
            steps.push(parseIdLeadLine(ts));
        } else {
            throw Error.invalidLine(t);
        }

    }

    ts.back();
    if (ts.next().type == TokenType.EOF && !rootBlock) {
        ts.back();
        throw Error.invalidToken(TokenType.CLOSE_BLOCK, ts.next());
    }

    return steps;
}

