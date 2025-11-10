// @ts-check

import { BooleanList, BooleanValue, Expression, NumberList, StringList, Value } from "./expressionParsing.js";
import { Action, Assign, Conditional, ExpressionAction, For, MakeProc, Return } from "./action.js";
import { Error } from "./error.js";

/**
 * @param {Action[]} ast
 */
export function execute(ast) {
    const primaryContext = {
        "DISPLAY": (/** @type {Expression[]} */ x) => { },
        "LENGTH": (/** @type {Expression[]} */ x) => { }
    };
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

    /**
     * @param {string} key
     * @param {any} val
     */
    insert(key, val) {
        this.context[key] = val;
    }
}

/**
 * @param {Action[]} block
 * @param {Context} context
 * @param {Context} gc 
 * @returns {Value|null}
 */
function executeBlock(block, context, gc) {
    for (const i in block) {
        const e = block[i];
        if (e instanceof MakeProc) {
            const fn = (/** @type {Expression[]} */ args, /** @type {[number, number]} */ call_range) => {
                const fnCtx = gc.makeChild();

                if (args.length != e.args.length) {
                    throw new Error(
                        call_range[0],
                        call_range[1],
                        `Invalid number of arguments passed to function "${e.name.value}"; expected ${e.args.length} found ${args.length}.`
                    );
                }

                for (let i = 0; i < args.length; i++) {
                    fnCtx.insert(e.args[i].value, args[i].evaluate(context));
                }

                return executeBlock(e.block, fnCtx, gc);
            };
            context.insert(e.name.value, fn);
        } else if (e instanceof Assign) {
            context.insert(e.variable.value, e.expression.evaluate(context));
        } else if (e instanceof Conditional) {
            const condition = e.conditional.evaluate(context);

            if (!(condition instanceof BooleanValue)) {
                throw Error.fromExpression(`Expected ${BooleanValue} found ${e.conditional.constructor.name}.`, e.conditional);
            }

            const blockReturn = executeBlock(condition.value ? e.block : e.elseBlock, context.makeChild(), gc);
            if (blockReturn) {
                return blockReturn;
            }
        } else if (e instanceof For) {
            const lst = e.list.evaluate();

            if (!(lst instanceof BooleanList || lst instanceof StringList || lst instanceof NumberList)) {
                throw Error.fromExpression(`Expected list found ${e.list.constructor.name}.`, e.list);
            }

            for (const i in lst.value) {
                const val = lst.value[i];

                const ctx = context.makeChild();
                ctx.insert(e.item.value, val);
                const blockReturn = executeBlock(e.block, ctx, gc);

                if (blockReturn) {
                    return blockReturn;
                }
            }
        } else if (e instanceof Return) {
            return e.value.evaluate();
        } else if (e instanceof ExpressionAction) {
            e.expression.evaluate();
        }
    }

    return null;
}
