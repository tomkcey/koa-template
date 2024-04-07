import { rateLimiter } from "../middlewares/limiting";

beforeAll(() => {
	process.env.NODE_ENV = "test";
});

afterEach(async () => rateLimiter.clear());