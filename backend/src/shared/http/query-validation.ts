import type { RequestHandler } from "express";

// Reject ambiguous, repeated and malformed query parameters before querying.
export const validateQuery: RequestHandler = (req, res, next) => {
  for (const [name, min, max] of [
    ["ano", 1, 9999], ["limit", 1, 2147483647], ["offset", 0, 2147483647],
  ] as const) {
    const value = req.query[name];
    if (value !== undefined && (typeof value !== "string" || !/^\d+$/.test(value)
      || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max)) {
      res.status(400).json({ error: "parametro_invalido", parametro: name });
      return;
    }
  }
  for (const name of ["parlamentar", "municipio", "funcao", "orgao"]) {
    if (req.query[name] !== undefined && typeof req.query[name] !== "string") {
      res.status(400).json({ error: "parametro_invalido", parametro: name });
      return;
    }
  }
  next();
};
