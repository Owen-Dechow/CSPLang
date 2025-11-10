// @ts-check

import { Expression } from "./expressionParsing.js";
import { Token } from "./tokens.js";

export class Action { }

export class MakeProc extends Action {
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

export class Conditional extends Action {
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

export class RepeatN extends Action {
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

export class RepeatUntil extends Action {
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

export class For extends Action {
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

export class Return extends Action {
    /**
     * @param {Expression} value
     */
    constructor(value) {
        super();

        /** @type {Expression} */
        this.value = value;
    }
}

export class Assign extends Action {
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

export class ExpressionAction extends Action {
    /**
     * @param {Expression} expression
     */
    constructor(expression) {
        super();

        /** @type {Expression} */
        this.expression = expression;
    }
}
