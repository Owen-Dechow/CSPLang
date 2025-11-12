// @ts-check

import { CSPError } from "./error.js";

/** @enum {string} */
export const TokenType = Object.freeze({
    ID: "ID",
    BOOL: "BOOL",
    NL: "NL",
    EOF: "EOF",
    STRING: "STRING",
    COMMENT: "COMMENT",
    PROCEDURE: "PROCEDURE",
    FOR: "FOR",
    EACH: "EACH",
    IN: "IN",
    IF: "IF",
    ELSE: "ELSE",
    RETURN: "RETURN",
    MOD: "MOD",
    NOT: "NOT",
    AND: "AND",
    OR: "OR",
    REPEAT: "REPEAT",
    TIMES: "TIMES",
    UNTIL: "UNTIL",
    OPEN_BRACKET: "OPEN_BRACKET",
    CLOSE_BRACKET: "CLOSE_BRACKET",
    ASSIGN: "ASSIGN",
    COMMA: "COMMA",
    EQUAL: "EQUAL",
    NOT_EQUAL: "NOT_EQUAL",
    LESS_THAN: "LESS_THAN",
    GREATER_THAN: "GREATER_THAN",
    LESS_THAN_OR_EQUAL: "LESS_THAN_OR_EQUAL",
    GREATER_THAN_OR_EQUAL: "GREATER_THAN_OR_EQUAL",
    OPEN_PAREN: "OPEN_PAREN",
    CLOSE_PAREN: "CLOSE_PAREN",
    ADD: "ADD",
    SUBTRACT: "SUBTRACT",
    MULTIPLY: "MULTIPLY",
    DIVIDE: "DIVIDE",
    OPEN_BLOCK: "OPEN_BLOCK",
    CLOSE_BLOCK: "CLOSE_BLOCK",
    NUMBER: "NUMBER",
});

/**
 * @typedef {keyof typeof TokenType} TokenTypeEnum
 */

export const wordTokens = {
    FOR: TokenType.FOR,
    EACH: TokenType.EACH,
    IN: TokenType.IN,
    IF: TokenType.IF,
    ELSE: TokenType.ELSE,
    RETURN: TokenType.RETURN,
    MOD: TokenType.MOD,
    NOT: TokenType.NOT,
    AND: TokenType.AND,
    OR: TokenType.OR,
    REPEAT: TokenType.REPEAT,
    TIMES: TokenType.TIMES,
    UNTIL: TokenType.UNTIL,
    PROCEDURE: TokenType.PROCEDURE,
    true: TokenType.BOOL,
    false: TokenType.BOOL,
};

export const operatorTokens = {
    "←": TokenType.ASSIGN,
    "[": TokenType.OPEN_BRACKET,
    "]": TokenType.CLOSE_BRACKET,
    ",": TokenType.COMMA,
    "=": TokenType.EQUAL,
    "≠": TokenType.NOT_EQUAL,
    "<": TokenType.LESS_THAN,
    ">": TokenType.GREATER_THAN,
    "≤": TokenType.LESS_THAN_OR_EQUAL,
    "≥": TokenType.GREATER_THAN_OR_EQUAL,
    "(": TokenType.OPEN_PAREN,
    ")": TokenType.CLOSE_PAREN,
    "+": TokenType.ADD,
    "-": TokenType.SUBTRACT,
    "*": TokenType.MULTIPLY,
    "/": TokenType.DIVIDE,
    "{": TokenType.OPEN_BLOCK,
    "}": TokenType.CLOSE_BLOCK,
    "//": TokenType.COMMENT,
};

export class Token {
    /**
     * @param {string} value
     * @param {number} loc
     * @param {TokenTypeEnum} type
     */
    constructor(value, type, loc) {
        /** @type {TokenTypeEnum} */
        this.type = type;

        /** @type {string} */
        this.value = value;

        /** @type {number} */
        this.loc = loc + 1;
    }
}

export class TokenStream {
    /**
     * @param {Token[]} tokens
     */
    constructor(tokens) {
        /** @type {Token[]} */
        this.tokens = tokens;

        /** @type {number} */
        this.loc = -1;
    }

    /** @returns {Token} */
    next() {
        if (this.loc < this.tokens.length)
            this.loc += 1;

        return this.tokens[this.loc];
    }

    /** @returns {Token} */
    nextSig() {
        const t = this.next();

        /** @type {TokenTypeEnum[]} */
        const insignificant = [TokenType.COMMENT, TokenType.NL];

        if (insignificant.includes(t.type))
            return this.nextSig();

        return t;
    }

    /** @returns {Token} */
    jumpToSig() {
        const t = this.nextSig();
        this.back();
        return t;
    }

    back() {
        this.loc -= 1;
    }

    /** 
     * @param {TokenTypeEnum} type
     * @returns Token 
     */
    takeSigOfType(type) {
        const t = this.nextSig();

        if (t.type != type)
            throw CSPError.invalidToken(type, t);

        return t;
    }
}
