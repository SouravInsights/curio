import { Type } from "@sinclair/typebox";

/** The one failure shape every route answers with (see plugins/error-handler.ts). */
export const ErrorResponse = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    why: Type.Optional(Type.String()),
    fix: Type.Optional(Type.String()),
    details: Type.Optional(
      Type.Array(Type.Object({ field: Type.String(), message: Type.String() })),
    ),
  }),
});

/** Every route documents the failures the error handler can produce. */
export const commonErrors = {
  400: ErrorResponse,
  401: ErrorResponse,
  404: ErrorResponse,
  429: ErrorResponse,
  500: ErrorResponse,
} as const;
