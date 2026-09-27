type AnyFn = (...args: any[]) => any;

type Builder = {
  inputValidator: (fn: AnyFn) => Builder;
  validator: (fn: AnyFn) => Builder;
  middleware: (_items: any[]) => Builder;
  handler: (fn: AnyFn) => AnyFn;
};

export function createServerFn(_opts?: any): Builder {
  let validate: AnyFn = (value: any) => value;
  const builder: Builder = {
    inputValidator(fn) {
      validate = fn;
      return builder;
    },
    validator(fn) {
      validate = fn;
      return builder;
    },
    middleware() {
      return builder;
    },
    handler(fn) {
      return async (arg?: any) => {
        const raw = arg && typeof arg === "object" && "data" in arg ? arg.data : arg;
        const data = validate ? validate(raw) : raw;
        return fn({ data });
      };
    },
  };
  return builder;
}
