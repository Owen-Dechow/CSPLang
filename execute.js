// @ts-check

import { BooleanValue, Expression, ListValue, NullValue, NumberValue, Value } from "./expressions.js";
import { Action, Assign, Conditional, ExpressionAction, For, MakeProc, Return } from "./action.js";
import { CSPError } from "./error.js";
import { Token } from "./tokens.js";

/**
 * @param {Action[]} ast
 */
export function execute(ast) {
    const gc = new Context();
    gc.context = {
        "DISPLAY": (/** @type {Expression[]} */ x, cr, /** @type {Context} */ ctx) => { console.log(x[0].evaluate(ctx)); return new NullValue(null); },
        "LENGTH": (/** @type {Expression[]} */ x, cr, /** @type {Context} */ ctx) => { let a = x[0].evaluate(ctx); return new NumberValue(a.value.length); }
    };

    const result = executeBlock(ast, gc, gc);
}

export class Context {
    constructor() {
        /**
         * @type {Object.<string, Value | (function(Expression[], [number, number], Context): Value|null)> }
         */
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
        /** @type {Context | null} */
        let parent = this;

        while (true) {
            parent = parent.parentContext;

            if (parent) {
                if (parent.context[key]) {
                    parent.context[key] = val;
                }
            }
            else {
                this.context[key] = val;
                break;
            }
        }
    }

    /**
     * @param {Token} token 
     * @returns {Value | (function(Expression[], [number, number], Context): Value|null)}
     */
    getValue(token) {
        const obj = this.context[token.value];

        if (obj != undefined)
            return obj;

        if (this.parentContext)
            return this.parentContext.getValue(token);

        let end = token.loc;
        let start = token.loc - token.value.length;
        throw new CSPError(start, end, `"${token.value}" is not a identity in the current scope.`);
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
            const fn = (/** @type {Expression[]} */ args, /** @type {[number, number]} */ call_range, /** @type {Context} */ ctx) => {
                const fnCtx = gc.makeChild();

                if (args.length != e.args.length) {
                    throw new CSPError(
                        call_range[0],
                        call_range[1],
                        `Invalid number of arguments passed to function "${e.name.value}"; expected ${e.args.length} found ${args.length}.`
                    );
                }

                for (let i = 0; i < args.length; i++) {
                    fnCtx.insert(e.args[i].value, args[i].evaluate(ctx));
                }

                return executeBlock(e.block, fnCtx, gc);
            };
            context.insert(e.name.value, fn);
        } else if (e instanceof Assign) {
            context.insert(e.variable.value, e.expression.evaluate(context));
        } else if (e instanceof Conditional) {
            const condition = e.conditional.evaluate(context);

            if (!(condition instanceof BooleanValue)) {
                throw CSPError.fromExpression(`Expected ${BooleanValue.name} found ${e.conditional.constructor.name}.`, e.conditional);
            }

            const blockReturn = executeBlock(condition.value ? e.block : e.elseBlock, context.makeChild(), gc);
            if (blockReturn) {
                return blockReturn;
            }
        } else if (e instanceof For) {
            const lst = e.list.evaluate(context);

            if (!(lst instanceof ListValue)) {
                throw CSPError.fromExpression(`Expected list found ${e.list.constructor.name}.`, e.list);
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
            return e.value.evaluate(context);
        } else if (e instanceof ExpressionAction) {
            e.expression.evaluate(context);
        }
    }

    return null;
}
