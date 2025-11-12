// @ts-check

/**
 * @import {TokenTypeEnum} from "./tokens.js"
 * @import {Context} from "./execute.js" 
 */

import { TokenType, TokenStream, Token } from "./tokens.js";
import { CSPError } from "./error.js";

export class Value {
    /**
     * @param {string | number | boolean | any} v
     */
    constructor(v) {
        /**
         * @type {string | number | boolean | any[]}
         */
        this.value = v;
    }
}

export class NumberValue extends Value {
    /**
     * @param {number} v
     */
    constructor(v) {
        super(v);
        /** @type {number} */
        this.value = v;
    }
}

export class StringValue extends Value {
    /**
     * @param {string} v
     */
    constructor(v) {
        super(v);
        /** @type {string} */
        this.value = v;
    }
}

export class BooleanValue extends Value {
    /**
     * @param {boolean} v
     */
    constructor(v) {
        super(v);
        /** @type {boolean} */
        this.value = v;
    }
}

export class ListValue extends Value {
    /**
     * @param {Value[]} v
     */
    constructor(v) {
        super(v);
        /** @type {Value[]} */
        this.value = v;
    }
}

export class NullValue extends Value { }

export class Expression {
    /**
     * @param {Context} _context
     * @returns {Value}
     */
    evaluate(_context) {
        throw new Error("NOT YET IMPLIMENTED");
    }

    getLocRange() {
        throw new Error("NOT YET IMPLIMENTED");
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

    /**
     * @param {Context} context
     * @returns {Value}
     */
    evaluate(context) {
        const left = this.left.evaluate(context);
        const right = this.right.evaluate(context);

        let type = this.token.type;

        // NullValue, NumberValue, StringValue, BooleanValue, ListValue  

        if (left.constructor != right.constructor) {
            let errorRange = [0, 100];//this.getLocRange(); // TODO
            throw new CSPError(
                errorRange[0],
                errorRange[1],
                `Left and right hand sides of "${this.token.type}" are of different types; left is of type ${left.constructor.name}, and right is of type ${right.constructor.name}.`
            );
        }

        let binOps = {};

        if (left instanceof NumberValue) {
            binOps[TokenType.ADD] = (a, b) => new NumberValue(a + b);
            binOps[TokenType.SUBTRACT] = (a, b) => new NumberValue(a - b);
            binOps[TokenType.DIVIDE] = (a, b) => new NumberValue(a / b);
            binOps[TokenType.MULTIPLY] = (a, b) => new NumberValue(a * b);
            binOps[TokenType.GREATER_THAN] = (a, b) => new BooleanValue(a > b);
            binOps[TokenType.LESS_THAN] = (a, b) => new BooleanValue(a < b);
            binOps[TokenType.EQUAL] = (a, b) => new BooleanValue(a === b);
            binOps[TokenType.NOT_EQUAL] = (a, b) => new BooleanValue(a !== b);
            binOps[TokenType.LESS_THAN_OR_EQUAL] = (a, b) => new BooleanValue(a <= b);
            binOps[TokenType.GREATER_THAN_OR_EQUAL] = (a, b) => new BooleanValue(a >= b);
            binOps[TokenType.MOD] = (a, b) => new NumberValue(a % b);
        } else if (left instanceof StringValue) {
            binOps[TokenType.ADD] = (a, b) => new StringValue(a + b);
            binOps[TokenType.EQUAL] = (a, b) => new BooleanValue(a === b);
            binOps[TokenType.NOT_EQUAL] = (a, b) => new BooleanValue(a !== b);
        } else if (left instanceof BooleanValue) {
            binOps[TokenType.AND] = (a, b) => new BooleanValue(a && b);
            binOps[TokenType.OR] = (a, b) => new BooleanValue(a || b);
            binOps[TokenType.EQUAL] = (a, b) => new BooleanValue(a === b);
            binOps[TokenType.NOT_EQUAL] = (a, b) => new BooleanValue(a !== b);
        } else if (left instanceof NullValue) {
            throw new Error("NOT YET IMPLIMENTED");
        } else {
            throw new Error("SHOULD NEVER GET TO THIS POINT");
        }

        const op = binOps[type];

        if (op != undefined)
            return op(left.value, right.value);

        throw new Error("NOT YET IMPLIMENTED");
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

    /**
     * @param {Context} _context
     */
    evaluate(_context) {
        let type = this.token.type;

        if (type == TokenType.NUMBER) {
            return new NumberValue(parseFloat(this.token.value));
        } else if (type == TokenType.BOOL) {
            return new BooleanValue(this.token.value == "true");
        } else {
            const string = this.token.value.slice(1, this.token.value.length - 1);
            return new StringValue(string);
        }
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

    /**
     * @param {Context} context
     */
    evaluate(context) {
        let object = context.getValue(this.token);
        if (object instanceof Value)
            return object;

        let end = this.token.loc;
        let start = this.token.loc - this.token.value.length;
        throw new CSPError(start, end, `"${this.token.value}" is a procedure; you may not reference it outside of a call.`);
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

    /**
     * @param {Context} context
     */
    evaluate(context) {
        return this.innerExpression.evaluate(context);
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

    /**
     * @param {Context} context
     */
    evaluate(context) {
        let list = [];
        this.items.forEach(e => { list.push(e.evaluate(context)); });
        return new ListValue(list);
    }
}

export class FunctionCall extends Expression {
    /**
     * @param {Token} func 
     * @param {Expression[]} args 
     */
    constructor(func, args) {
        super();

        /** @type {Token}  */
        this.func = func;

        /** @type {Expression[]}  */
        this.args = args;
    }

    /**
     * @param {Context} context
     */
    evaluate(context) {
        let func = context.getValue(this.func);

        if (func instanceof Value)
            throw new Error("NOT YET IMPLIMENTED");

        const start = this.func.loc;
        const end = this.func.loc - this.func.value.length;
        let returnVal = func(this.args, [start, end], context);
        return returnVal == null ? new NullValue() : returnVal;
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

        throw CSPError.invalidToken(closer, commaOrClose);
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
                exp = new FunctionCall(exp.token, args);
            } else {
                ts.back();
                break;
            }
        }
    }

    if (exp == null) {
        ts.back();
        throw CSPError.expectedExpression(ts.next());
    }

    return exp;
}
