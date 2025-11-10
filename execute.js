// @ts-check

import { Action } from "./action.js";

/**
 * @param {Action[]} ast
 */
export function execute(ast) {

}

class Context {
    constructor() {
        this.context = {};

        /**
         * @type {Context | null}
         */
        this.parentContext = null;
    }

    makeChild() {
        const ctx = new Context();
        ctx.parentContext = this;

        return ctx;
    }
}

/**
 * @param {Action[]} block
 * @param {Context} context
 */
function executeBlock(block, context) { }
