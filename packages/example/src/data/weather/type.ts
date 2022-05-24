import zod from "zod";

export const Weather = zod.object({
	temperature: zod.string(),
});

export type Weather = zod.infer<typeof Weather>;
