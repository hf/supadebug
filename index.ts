import { OpenAIApi, Configuration } from "openai";

let chatgpt: OpenAIApi | null = null;
const errors: Record<string, any[]> = {};

const firstchars = "abcdefghijklmnopqrstuvwxyz".split("");
const restchars = (firstchars.join("") + "0123456789").split("");

function setError(args: any[]): string {
  const code = [];

  while (true) {
    code[0] = firstchars[Math.floor(Math.random() * firstchars.length)];
    for (let i = 0; i < 3; i += 1) {
      code[i + 1] = restchars[Math.floor(Math.random() * restchars.length)];
    }

    let codeString = code.join("");
    if (!errors.hasOwnProperty(codeString)) {
      errors[codeString] = args;
      return codeString;
    }
  }

  throw new Error("Unreachable code");
}

function wrap(
  _console: any,
  prop: string
): (<A extends any[]>(...args: A) => void) | null {
  if (typeof _console[prop] === "function") {
    try {
      const _fn = _console[prop];
      _console[prop] = <A extends any[]>(...args: A) => {
        let first = args[0];

        if (typeof first === "string") {
          const code = setError([...args]);

          first = `[supadebug.${code}()] ${first}`;
          args.shift();

          _fn.bind(_console)(first, ...args);
        } else {
          _fn.bind(_console)(...args);
        }
      };

      return _fn.bind(_console);
    } catch (e: unknown) {
      // do nothing
    }
  }

  return null;
}

export function supadebug(apiKey: string) {
  chatgpt = new OpenAIApi(
    new Configuration({
      apiKey,
    })
  );

  const _globalThis: any = window || globalThis;
  const _console = _globalThis.console;
  const _onerror = _globalThis.onerror;
  const _addEventListener = _globalThis.addEventListener;

  let _log: ReturnType<typeof wrap> = null;
  let _warn: ReturnType<typeof wrap> = null;
  let _error: ReturnType<typeof wrap> = null;

  if (typeof _console === "object") {
    _log = wrap(_console, "log");
    _warn = wrap(_console, "warn");
    _error = wrap(_console, "error");
  }

  if (typeof _addEventListener === "function") {
    try {
      _addEventListener.bind(_globalThis)("error", () => {});
    } catch (e: unknown) {
      // do nothing
    }
  } else if (typeof _onerror === "function") {
    try {
      _onerror.bind(_globalThis)(() => {});
    } catch (e: unknown) {
      // do nothing
    }
  }

  _globalThis.supadebug = new Proxy(() => {}, {
    get: (target: any, prop: any, _receiver) => {
      return () => {
        if (errors.hasOwnProperty(prop)) {
          if (_log) {
            _log("Asking ChatGPT about your problem... hold on a minute");

            (async () => {
              const res = await chatgpt.createCompletion({
                model: "text-davinci-003",
                prompt: `What is the common cause of this error in JavaScript?\n${errors[
                  prop
                ]
                  .map((x) => x.toString())
                  .join("\n")}`,
                max_tokens: 2049,
              });

              _log(
                res.data.choices
                  .map((c) => c.text)
                  .join("\nor\n")
                  .trim()
              );
            })();
          }
        }
      };

      return target[prop];
    },
  });
}
