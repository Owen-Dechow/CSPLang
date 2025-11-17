// @ts-check

import { BooleanValue, Expression, ListValue, NullValue, NumberValue, StringValue, Value } from "./expressions.js";
import { Action, Assign, Conditional, ExpressionAction, For, MakeProc, RepeatN, RepeatUntil, Return } from "./action.js";
import { CSPError } from "./error.js";
import { Token } from "./tokens.js";

/**
 * @param {number} nArgs
 * @param {string} name
 * @param {function(Value[], [number, number]): Value} callback
 */
function makeBuiltinFunction(nArgs, name, callback) {
    return (/** @type {Expression[]} */ args, /** @type {[number, number]} */ call_range, /** @type {Context} */ ctx) => {
        if (nArgs != args.length) {
            throw new CSPError(
                call_range[0],
                call_range[1],
                `Incorrect number of arguments passed to function "${name}"; expected ${nArgs} found ${args.length}.`
            );
        }

        let vArgs = [];
        for (let i = 0; i < args.length; i++) {
            vArgs.push(args[i].evaluate(ctx));
        }

        return callback(vArgs, call_range);
    };
}

/**
 * @param {[number, number]} range
 * @param {any[]} lst
 * @param {number} idx
 * @param {boolean} allowNextEmpty
 */
function throwBadIdx(range, lst, idx, allowNextEmpty) {
    const throwErr = () => {
        throw CSPError.fromRange(range, `${idx} is not a valid index for list of length ${lst.length}.`);
    };

    if (idx < 1)
        throwErr();


    if (allowNextEmpty) {
        if (idx > lst.length + 1)
            throwErr();
    } else {
        if (idx > lst.length)
            throwErr();
    }
}

/**
 * @param {Action[]} ast
 */
export function execute(ast) {
    const gc = new Context();
    gc.context = {
        "LENGTH": makeBuiltinFunction(1, "LENGTH", (args, cr) => {
            let lst = args[0];

            if (lst instanceof ListValue)
                return new NumberValue(lst.value.length);
            else if (lst instanceof StringValue)
                return new NumberValue(lst.value.length);

            throw CSPError.fromRange(cr, `The function "LENGTH" expected ${ListValue.name} or ${StringValue.name}; found ${lst.constructor.name}.`);
        }),
        "DISPLAY": makeBuiltinFunction(1, "DISPLAY", (args, cr) => {
            let arg = args[0];

            if (arg instanceof StringValue || arg instanceof NumberValue || arg instanceof BooleanValue) {
                // @ts-ignore
                document.querySelector("#output").textContent += " " + arg.value;

                return new NullValue();
            } else if (arg instanceof ListValue) {
                throw CSPError.fromRange(cr, `The function "DISPLAY" can not directly take a list.`);
            } else if (arg instanceof NullValue) {
                throw CSPError.nullValueError(cr);
            }

            throw new Error("SHOULD NEVER HIT THIS POINT");
        }),
        "RANDOM": makeBuiltinFunction(2, "RANDOM", (args, cr) => {
            const [a, b] = args;

            if (!(a instanceof NumberValue && b instanceof NumberValue)) {
                throw CSPError.fromRange(cr, `The function "RANDOM" expected two ${NumberValue.name}; found ${a.constructor.name} and ${b.constructor.name}.`);
            }

            if (a.value != Math.round(a.value) || b.value != Math.round(b.value)) {
                throw CSPError.fromRange(cr, `The function "RANDOM" expected two integers; found ${a.value} and ${b.value}.`);
            }

            const min = Math.min(a.value, b.value);
            const max = Math.max(a.value, b.value);
            return new NumberValue((max - min) * Math.random() + min);
        }),
        "INSERT": makeBuiltinFunction(3, "INSERT", (args, cr) => {
            const [lst, idx, val] = args;

            if (!(lst instanceof ListValue)) {
                throw CSPError.fromRange(cr, `The function "INSERT" expected ${ListValue.name} as argument 1; found ${lst.constructor.name}.`);
            }

            if (!(idx instanceof NumberValue)) {
                throw CSPError.fromRange(cr, `The function "INSERT" expected ${NumberValue.name} as argument 2; found ${lst.constructor.name}.`);
            }

            throwBadIdx(cr, lst.value, idx.value, true);

            lst.value.splice(idx.value + 1, 0, val);
            return new NullValue();
        }),
        "APPEND": makeBuiltinFunction(2, "APPEND", (args, cr) => {
            const [lst, val] = args;

            if (!(lst instanceof ListValue)) {
                throw CSPError.fromRange(cr, `The function "APPEND" expected ${ListValue.name} as argument 1; found ${lst.constructor.name}.`);
            }

            lst.value.push(val);
            return new NullValue();
        }),
        "REMOVE": makeBuiltinFunction(2, "REMOVE", (args, cr) => {
            const [lst, idx] = args;

            if (!(lst instanceof ListValue)) {
                throw CSPError.fromRange(cr, `The function "REMOVE" expected ${ListValue.name} as argument 1; found ${lst.constructor.name}.`);
            }

            if (!(idx instanceof NumberValue)) {
                throw CSPError.fromRange(cr, `The function "REMOVE" expected ${ListValue.name} as argument 1; found ${lst.constructor.name}.`);
            }

            throwBadIdx(cr, lst.value, idx.value, false);

            lst.value.splice(idx.value, 1);
            return new NullValue();
        }),
        "INPUT": makeBuiltinFunction(0, "INPUT", (_, __) => {
            const val = window.prompt(`Enter your input to "INPUT()" here.`) || "";
            return Value.fromInput(val);
        })
    };

    executeBlock(ast, gc, gc);
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
        if (!this.updateInsert(key, val)) {
            this.context[key] = val;
        }
    }

    /**
     * @param {string} key
     * @param {any} val
     * @returns boolean
     */
    updateInsert(key, val) {
        if (this.context[key]) {
            this.context[key] = val;
            return true;
        } else if (this.parentContext) {
            return this.parentContext.updateInsert(key, val);
        } else {
            return false;
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
                        `Incorrect number of arguments passed to function "${e.name.value}"; expected ${e.args.length} found ${args.length}.`
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
                throw CSPError.fromExpression(`Expected ${ListValue.name} found ${lst.constructor.name}.`, e.list);
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
        } else if (e instanceof RepeatUntil) {
            let condition = e.conditional.evaluate(context);

            if (!(condition instanceof BooleanValue)) {
                throw CSPError.fromExpression(`Expected ${BooleanValue.name} found ${condition.constructor.name}.`, e.conditional);
            }

            while (!condition.value) {
                const blockReturn = executeBlock(e.block, context.makeChild(), gc);
                if (blockReturn) {
                    return blockReturn;
                }

                condition = e.conditional.evaluate(context);
                if (!(condition instanceof BooleanValue)) {
                    throw CSPError.fromExpression(`Expected ${BooleanValue.name} found ${condition.constructor.name}.`, e.conditional);
                }
            }

        } else if (e instanceof RepeatN) {
            let n = e.n.evaluate(context);
            if (!(n instanceof NumberValue)) {
                throw CSPError.fromExpression(`Expected ${NumberValue.name} found ${n.constructor.name}.`, e.n);
            }

            for (let i = 0; i < n.value; i++) {
                const blockReturn = executeBlock(e.block, context.makeChild(), gc);
                if (blockReturn) {
                    return blockReturn;
                }
            }

        } else {
            throw Error("SHOULD NEVER HIT THIS POINT");
        }
    }

    return null;
}
