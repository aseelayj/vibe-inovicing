import type { Request, Response } from 'express';

/**
 * Parse an integer ID from route params, returning null + 400 response if invalid.
 */
export function parseId(
  req: Request,
  res: Response,
  param = 'id',
): number | null {
  const raw = req.params[param];
  const id = parseInt(typeof raw === 'string' ? raw : '', 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: `Invalid ${param}` });
    return null;
  }
  return id;
}
