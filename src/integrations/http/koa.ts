import Koa, {
	DefaultContext,
	DefaultState,
	Next,
	Request,
	Response,
} from "koa";
import KoaRouter from "koa-router";
import { Handler, Http, Method, Middleware } from "./http";
import { logger } from "../../utils/logging";

/**
 * [Stack Overflow Link](https://stackoverflow.com/a/58436959/11688144)
 */
type Paths<T> = T extends object
	? {
			[K in keyof T]: `/${Exclude<K, symbol>}${"" | `${Paths<T[K]>}`}`;
		}[keyof T]
	: never;

export class KoaHttp implements Http<Request, Response, Next> {
	public app: Koa<DefaultState, DefaultContext> = new Koa();
	protected router = {
		v1: { achievements: { [":id"]: {} } },
		ping: {},
	} as const;
	protected routerMap = new Map<Paths<typeof this.router>, KoaRouter>();
	protected routerMethodMap = new Map<
		Paths<typeof this.router>,
		Set<Method>
	>();

	private getRouter(url: Paths<typeof this.router>) {
		const maybeRouter = this.routerMap.get(url);
		if (maybeRouter) {
			return maybeRouter;
		}
		const router = new KoaRouter();
		this.routerMap.set(url, router);
		return router;
	}

	private isMethodAlreadyBound(
		url: Paths<typeof this.router>,
		method: Method,
	) {
		const maybeSet = this.routerMethodMap.get(url);
		if (!maybeSet) {
			const set = new Set<Method>();
			set.add(method);
			this.routerMethodMap.set(url, set);
			return false;
		}

		const maybeMethod = maybeSet.has(method);
		if (maybeMethod) {
			return true;
		}

		maybeSet.add(method);
		this.routerMethodMap.set(url, maybeSet);
		return false;
	}

	/**
	 * Creates a controller for a specific route.
	 */
	public createController(
		url: Paths<typeof this.router>,
		method: Method,
		handler: Handler<Request, Response>,
	) {
		const router = this.getRouter(url);
		if (this.isMethodAlreadyBound(url, method)) {
			throw new Error(`Method ${method} already bound to ${url}`);
		}

		router[method](url, async (ctx) => handler(ctx.request, ctx.response));
		this.app.use(router.routes());
		return this;
	}

	/**
	 * Adds a middleware to the application or a specific route.
	 */
	public middleware(
		handler: Middleware<Request, Response, Next>,
		url?: Paths<typeof this.router>,
	) {
		const app = (() => {
			if (url) {
				const router = this.getRouter(url);
				if (router) {
					return router;
				}
			}
			return this.app;
		})();

		app.use(async (ctx, next) => handler(ctx.request, ctx.response, next));

		return this;
	}

	async start(port: number) {
		this.app.listen(port, () => {
			logger.info(`Listening on port ${port}`);
		});
	}
}

export namespace KoaHttp {
	let server: KoaHttp | null = null;

	export function getKoaHttpServer() {
		if (!server) {
			server = new KoaHttp();
		}
		return server;
	}

	export function cleanup() {
		if (server) {
			server.app.removeAllListeners();
			server = null;
		}
	}
}
