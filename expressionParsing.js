// @ts-check

/**
 * @typedef {import("./tokens.js").TokenTypeEnum} TokenTypeEnum
 */

import { TokenType, TokenStream, Token } from "./tokens.js";
import { Error } from "./error.js";

export class Value { }

export class NumberValue extends Value {
    /**
     * @param {number} v
     */
    constructor(v) {
        super();
        /** @type {number} */
        this.value = v;
    }
}

export class StringValue extends Value {
    /**
     * @param {string} v
     */
    constructor(v) {
        super();
        /** @type {string} */
        this.value = v;
    }
}

export class BooleanValue extends Value {
    /**
     * @param {boolean} v
     */
    constructor(v) {
        super();
        /** @type {boolean} */
        this.value = v;
    }
}

export class NumberList extends Value {
    /**
     * @param {number[]} v
     */
    constructor(v) {
        super();
        /** @type {number[]} */
        this.value = v;
    }
}

export class StringList extends Value {
    /**
     * @param {string[]} v
     */
    constructor(v) {
        super();
        /** @type {string[]} */
        this.value = v;
    }
}

export class BooleanList extends Value {
    /**
     * @param {boolean[]} v
     */
    constructor(v) {
        super();
        /** @type {boolean[]} */
        this.value = v;
    }
}

export class Expression {
    /** @returns {Value} */
    evaluate(context) {
        throw "NOT YET IMPLIMENTED";
    }

    getLocRange() {
        throw "NOT YET IMPLIMENTED";
    }
}

export class BinaryExpression extends Expression {
    /**
     * @param {Expression} left
     * @param {Token} token
     * @param {Expression} right
     */
    constructor(left, token, right) {
        super();

        /** @type {Expression}  */
        this.left = left;

        /** @type {Expression}  */
        this.right = right;

        /** @type {Token}  */
        this.token = token;
    }
}

export class LiteralExpression extends Expression {
    /**
     * @param {Token} token
     */
    constructor(token) {
        super();

        /** @type {Token}  */
        this.token = token;
    }
}

export class IdentityExpression extends Expression {
    /**
     * @param {Token} token
     */
    constructor(token) {
        super();
        this.token = token;
    }
}

export class ContainerExpression extends Expression {
    /**
     * @param {Expression} innerExpression
     */
    constructor(innerExpression) {
        super();

        /** @type {Expression}  */
        this.innerExpression = innerExpression;
    }
}

export class ListExpression extends Expression {
    /**
     * @param {Expression[]} items 
     */
    constructor(items) {
        super();

        /** @type {Expression[]}  */
        this.items = items;
    }
}

export class FunctionCall extends Expression {
    /**
     * @param {Expression} func 
     * @param {Expression[]} args 
     */
    constructor(func, args) {
        super();

        /** @type {Expression}  */
        this.func = func;

        /** @type {Expression[]}  */
        this.args = args;
    }
}

export class UnaryExpression extends Expression {
    /**
     * @param {Token} token
     * @param {Expression} innerExpression
     */
    constructor(token, innerExpression) {
        super();

        /** @type {Expression} */
        this.innerExpression = innerExpression;

        /** @type {Token} */
        this.token = token;
    }
}

/**
 * @param {TokenStream} ts
 * @param {boolean} argList
 * @returns {Expression[]}
 */
function parseExpressionList(ts, argList) {
    const closer = argList ? TokenType.CLOSE_PAREN : TokenType.CLOSE_BRACKET;

    let items = [];

    while (true) {
        let t = ts.nextSig();

        if (t.type == closer)
            break;
        else
            ts.back();

        items.push(parseExpression(ts));

        let commaOrClose = ts.nextSig();

        if (commaOrClose.type == TokenType.COMMA)
            continue;

        if (commaOrClose.type == closer)
            break;

        throw Error.invalidToken(closer, commaOrClose);
    }

    return items;
}

/** 
 * @param {TokenStream} ts 
 * @returns {Expression}
 */
export function parseExpression(ts) {
    /** @type {null|Expression} */
    let exp = null;

    while (true) {
        let t = ts.nextSig();
        if (exp == null) {
            if (t.type == TokenType.NUMBER) {
                exp = new LiteralExpression(t);
            } else if (t.type == TokenType.STRING) {
                exp = new LiteralExpression(t);
            } else if (t.type == TokenType.BOOL) {
                exp = new LiteralExpression(t);
            } else if (t.type == TokenType.ID) {
                exp = new IdentityExpression(t);
            } else if (t.type == TokenType.OPEN_PAREN) {
                const innerExp = parseExpression(ts);
                exp = new ContainerExpression(innerExp);
                ts.takeSigOfType(TokenType.CLOSE_PAREN);
            } else if (t.type == TokenType.OPEN_BRACKET) {
                exp = new ListExpression(parseExpressionList(ts, false));
            } else if (t.type == TokenType.SUBTRACT) {
                const innerExp = parseExpression(ts);
                return new UnaryExpression(t, innerExp);
            } else if (t.type == TokenType.NOT) {
                const innerExp = parseExpression(ts);
                return new UnaryExpression(t, innerExp);
            } else {
                break;
            }
        } else {
            /** @type {TokenTypeEnum[]} */
            const binaryOperations = [
                TokenType.ADD, TokenType.SUBTRACT,
                TokenType.DIVIDE, TokenType.MULTIPLY, TokenType.AND, TokenType.OR,
                TokenType.GREATER_THAN, TokenType.LESS_THAN, TokenType.EQUAL,
                TokenType.NOT_EQUAL, TokenType.LESS_THAN_OR_EQUAL, TokenType.GREATER_THAN_OR_EQUAL,
                TokenType.MOD
            ];

            if (binaryOperations.includes(t.type)) {
                exp = new BinaryExpression(exp, t, parseExpression(ts));
            } else if (t.type == TokenType.OPEN_PAREN && exp instanceof IdentityExpression) {
                const args = parseExpressionList(ts, true);
                exp = new FunctionCall(exp, args);
            } else {
                ts.back();
                break;
            }
        }
    }

    if (exp == null) {
        ts.back();
        throw Error.expectedExpression(ts.next());
    }

    return exp;
}
